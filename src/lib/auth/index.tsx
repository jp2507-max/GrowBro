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

  // Prevent concurrent auth operations
  _authOperationInProgress: boolean;

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
  const { data, error } = await supabase.auth.setSession({
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
    session: data.session,
    user: data.session?.user ?? null,
    lastValidatedAt: Date.now(),
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

async function withAuthMutex<T>(
  operation: () => Promise<T>,
  get: () => AuthState,
  set: (state: Partial<AuthState>) => void
): Promise<T> {
  while (get()._authOperationInProgress) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  set({ _authOperationInProgress: true });
  try {
    return await operation();
  } finally {
    set({ _authOperationInProgress: false });
  }
}

async function performSignIn(
  data: TokenType | { session: Session; user: User },
  get: () => AuthState,
  set: (state: Partial<AuthState>) => void
): Promise<void> {
  await withAuthMutex(
    async () => {
      if ('session' in data && 'user' in data) {
        await handleSignInWithSession(data.session, data.user, set);
      } else {
        await handleSignInWithToken(data as TokenType, set);
      }
    },
    get,
    set
  );
}

const _useAuth = create<AuthState>((set, get) => ({
  status: 'idle',
  token: null,
  user: null,
  session: null,
  lastValidatedAt: null,
  offlineMode: 'full',
  _authOperationInProgress: false,

  signIn: async (data) => performSignIn(data, get, set),

  signOut: async (skipRemote = false) => {
    await withAuthMutex(
      async () => {
        await handleSignOut(set, skipRemote);
      },
      get,
      set
    );
  },

  hydrate: async () => {
    try {
      const userToken = getToken();
      if (userToken !== null) {
        await get().signIn(userToken);
      } else {
        await get().signOut();
      }
    } catch (e) {
      console.error('Auth hydration error:', e);
      await get().signOut();
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

// Store auth listener subscription for cleanup
let authSubscription: {
  data: { subscription: { unsubscribe: () => void } };
} | null = null;

// Subscribe to Supabase auth state changes
// FIXED: Auth hydration race condition resolved
// Previously during hydration, hydrate() would load cached tokens and call signIn,
// which set _authOperationInProgress=true before supabase.auth.setSession(). The
// SIGNED_IN listener would then skip updating session/user state due to the mutex,
// leaving the store with status='signIn' but session=null/user=null. This broke
// downstream features that depend on hydrated auth state.
//
// SOLUTION: Modified handleSignInWithToken to populate session and user directly
// from the supabase.auth.setSession() response instead of relying on the auth
// state change listener, ensuring complete auth state during hydration.
authSubscription = supabase.auth.onAuthStateChange(async (event, session) => {
  const store = _useAuth.getState();

  if (event === 'SIGNED_IN' && session) {
    try {
      // Use mutex to prevent race with direct signIn calls
      await withAuthMutex(
        async () => {
          store.updateSession(session);
          if (session.user) {
            store.updateUser(session.user);
          }
        },
        _useAuth.getState,
        _useAuth.setState
      );
    } catch (error) {
      console.error('Error in SIGNED_IN handler:', error, {
        event,
        sessionId: session.user.id,
      });
    }
  } else if (event === 'SIGNED_OUT') {
    // Clear store on sign out
    await withAuthMutex(
      async () => {
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
      },
      _useAuth.getState,
      _useAuth.setState
    );
  } else if (event === 'TOKEN_REFRESHED' && session) {
    // Update session on token refresh
    await withAuthMutex(
      async () => {
        store.updateSession(session);
        if (session.user) {
          store.updateUser(session.user);
        }
      },
      _useAuth.getState,
      _useAuth.setState
    );
  } else if (event === 'USER_UPDATED' && session?.user) {
    // Update user data
    if (_useAuth.getState()._authOperationInProgress) {
      return;
    }
    _useAuth.setState({ _authOperationInProgress: true });
    try {
      store.updateUser(session.user);
    } finally {
      _useAuth.setState({ _authOperationInProgress: false });
    }
  }
});

export const useAuth = createSelectors(_useAuth);

export const signOut = async () => await _useAuth.getState().signOut();
export const signIn = async (
  data: TokenType | { session: Session; user: User }
) => await _useAuth.getState().signIn(data);
export const hydrateAuth = async () => await _useAuth.getState().hydrate();

// Export new session management actions
export const updateSession = async (session: Session) =>
  await _useAuth.getState().updateSession(session);
export const updateUser = async (user: User) =>
  await _useAuth.getState().updateUser(user);
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

// Export cleanup function for testing/unmount scenarios
export const cleanupAuthListener = () => {
  authSubscription?.data.subscription.unsubscribe();
  authSubscription = null;
};

// Export functions used by sign-out hooks
export { resetAgeGate } from '../compliance/age-gate';
export { stopIdleTimeout } from './session-timeout';
export { removeToken } from './utils';
