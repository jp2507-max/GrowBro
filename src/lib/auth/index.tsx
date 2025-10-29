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
  signIn: (data: TokenType | { session: Session; user: User }) => void;
  signOut: () => void;
  hydrate: () => void;
  updateSession: (session: Session) => void;
  updateUser: (user: User) => void;
  setOfflineMode: (mode: OfflineMode) => void;
  getStableSessionId: () => string | null;
}

const _useAuth = create<AuthState>((set, get) => ({
  status: 'idle',
  token: null,
  user: null,
  session: null,
  lastValidatedAt: null,
  offlineMode: 'full',

  signIn: (data) => {
    // Handle both legacy TokenType and new Session/User format
    if ('session' in data && 'user' in data) {
      const { session, user } = data;
      // Convert session to legacy token format for backward compatibility
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
    } else {
      // Legacy path - just token
      setToken(data as TokenType);
      startIdleTimeout(() => _useAuth.getState().signOut());
      set({ status: 'signIn', token: data as TokenType });
    }
  },

  signOut: () => {
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
  },

  hydrate: () => {
    try {
      const userToken = getToken();
      if (userToken !== null) {
        get().signIn(userToken);
      } else {
        get().signOut();
      }
    } catch (e) {
      console.error('Auth hydration error:', e);
      // On error, sign out to ensure clean state
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
    store.signIn({
      session,
      user: session.user,
    });
  } else if (event === 'SIGNED_OUT') {
    // Clear store on sign out
    store.signOut();
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

export const signOut = () => _useAuth.getState().signOut();
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
