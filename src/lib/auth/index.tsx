import type { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';

import { resetAgeGate } from '../compliance/age-gate';
import { supabase } from '../supabase';
import { createSelectors } from '../utils';
import { startIdleTimeout, stopIdleTimeout } from './session-timeout';
import type { TokenType } from './utils';
import { getStableSessionId, getToken, removeToken, setToken } from './utils';

type OfflineMode = 'full' | 'readonly' | 'blocked';

interface AuthState {
  // Legacy token field for backward compatibility
  token: TokenType | null;
  status: 'idle' | 'signOut' | 'signIn';

  // New Supabase session fields
  user: User | null;
  session: Session | null;
  lastValidatedAt: number | null;
  offlineMode: OfflineMode;

  // Actions
  signIn: (data: TokenType | { session: Session; user: User }) => Promise<void>;
  signOut: (skipRemote?: boolean) => Promise<void>;
  hydrate: () => Promise<void>;
  updateSession: (session: Session) => void;
  updateUser: (user: User) => void;
  updateLastValidatedAt: () => void;
  setOfflineMode: (mode: OfflineMode) => void;
  getStableSessionId: () => string | null;
}

async function handleSignInWithSession(
  session: Session,
  user: User,
  set: (state: Partial<AuthState>) => void
) {
  const { error } = await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  if (error) {
    throw error;
  }
  const token: TokenType = {
    access: session.access_token,
    refresh: session.refresh_token,
  };
  setToken(token);
  startIdleTimeout(() => _useAuth.getState().signOut());
  set({
    status: 'signIn',
    token,
    session,
    user,
    lastValidatedAt: Date.now(),
    offlineMode: 'full',
  });
}

async function handleSignInWithToken(
  token: TokenType,
  set: (state: Partial<AuthState>) => void
) {
  const { error } = await supabase.auth.setSession({
    access_token: token.access,
    refresh_token: token.refresh,
  });
  if (error) {
    throw error;
  }
  setToken(token);
  startIdleTimeout(() => _useAuth.getState().signOut());
  set({
    status: 'signIn',
    token,
    session: null,
    user: null,
    lastValidatedAt: null,
    offlineMode: 'full',
  });
}

async function handleSignOut(
  set: (state: Partial<AuthState>) => void,
  skipRemote = false
) {
  if (!skipRemote) {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Failed to revoke remote session:', error);
    }
  }
  removeToken();
  resetAgeGate();
  stopIdleTimeout();
  set({
    status: 'signOut',
    token: null,
    user: null,
    session: null,
    lastValidatedAt: null,
    offlineMode: 'full',
  });
}

const _useAuth = create<AuthState>((set, get) => ({
  status: 'idle',
  token: null,
  user: null,
  session: null,
  lastValidatedAt: null,
  offlineMode: 'full',

  signIn: async (data) => {
    try {
      if ('session' in data && 'user' in data) {
        await handleSignInWithSession(data.session, data.user, set);
      } else {
        await handleSignInWithToken(data as TokenType, set);
      }
    } catch (error) {
      console.error('Failed to set Supabase session:', error);
      throw error;
    }
  },

  signOut: async (skipRemote = false) => {
    await handleSignOut(set, skipRemote);
  },

  hydrate: async () => {
    try {
      const userToken = getToken();
      if (userToken !== null) {
        await get().signIn(userToken);
      } else {
        get().signOut();
      }
    } catch (e) {
      console.error('Auth hydration error:', e);
      get().signOut();
    }
  },

  updateSession: (session) => {
    const token: TokenType = {
      access: session.access_token,
      refresh: session.refresh_token,
    };
    setToken(token);
    set({ session, token, lastValidatedAt: Date.now() });
  },

  updateUser: (user) => {
    set({ user });
  },

  updateLastValidatedAt: () => {
    set({ lastValidatedAt: Date.now() });
  },

  setOfflineMode: (mode) => {
    set({ offlineMode: mode });
  },

  getStableSessionId: () => {
    return getStableSessionId();
  },
}));

// Subscribe to Supabase auth state changes
supabase.auth.onAuthStateChange(async (event, session) => {
  const store = _useAuth.getState();

  if (event === 'SIGNED_IN' && session) {
    // Update store with new session
    store.updateSession(session);
    if (session.user) {
      store.updateUser(session.user);
    }
  } else if (event === 'SIGNED_OUT') {
    // Clear store on sign out
    removeToken();
    resetAgeGate();
    stopIdleTimeout();
    _useAuth.setState({
      status: 'signOut',
      token: null,
      user: null,
      session: null,
      lastValidatedAt: null,
      offlineMode: 'full',
    });
  } else if (event === 'TOKEN_REFRESHED' && session) {
    // Update session on token refresh
    store.updateSession(session);
    if (session.user) {
      store.updateUser(session.user);
    }
  } else if (event === 'USER_UPDATED' && session?.user) {
    // Update user data
    store.updateUser(session.user);
  }
});

export const useAuth = createSelectors(_useAuth);

export const signOut = async () => await _useAuth.getState().signOut();
export const signIn = (token: TokenType) => _useAuth.getState().signIn(token);
export const hydrateAuth = () => _useAuth.getState().hydrate();

// Export new session management actions
export const updateSession = (session: Session) =>
  _useAuth.getState().updateSession(session);
export const updateUser = (user: User) => _useAuth.getState().updateUser(user);
export const setOfflineMode = (mode: OfflineMode) =>
  _useAuth.getState().setOfflineMode(mode);

// Export types
export type { OfflineMode, Session, User };

// Export auth utilities
export {
  AuthenticationError,
  getAuthenticatedUserId,
  getOptionalAuthenticatedUserId,
  validateAuthenticatedUserId,
} from './user-utils';

// Export functions used by sign-out hooks
export { resetAgeGate } from '../compliance/age-gate';
export { stopIdleTimeout } from './session-timeout';
export { removeToken } from './utils';
