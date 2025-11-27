import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';

import { resetAgeGate } from '../compliance/age-gate';
import { supabase } from '../supabase';
import { createSelectors } from '../utils';
import { clearAuthStorage } from './auth-storage';
import { startIdleTimeout, stopIdleTimeout } from './session-timeout';
import type { TokenType } from './utils';
import { getStableSessionId, getToken, removeToken, setToken } from './utils';

let authMutexSetAt: number | null = null;
let authMutexOperationId: number | null = null;
let authOperationIdCounter = 0;
// Track last mutex wait log time to avoid console spam in dev
let lastMutexWaitLogTime = 0;
// Track invalidated operation IDs to prevent stuck operations from interfering
// with new operations after mutex timeout reset. Uses array for explicit FIFO eviction.
const invalidatedOperationIds: number[] = [];
const MAX_INVALIDATED_IDS = 100;

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
  // Check if Supabase client already has this session active
  // (e.g., from signInWithPassword, signInWithIdToken, or OAuth)
  const { data: currentData } = await supabase.auth.getSession();
  const supabaseHasSession =
    currentData?.session?.access_token === session.access_token;

  if (!supabaseHasSession) {
    // Session came from external source (e.g., Edge Function) - need to set it
    // in the Supabase client so it can make authenticated requests.
    // This is safe because these are fresh tokens not yet known to the client.
    const { error } = await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });

    if (error) {
      console.error('[auth] Failed to set session in Supabase client:', error);
      throw error;
    }
  }
  // If Supabase already has this session, do NOT call setSession() again.
  // Calling setSession() with the same refresh token causes Supabase to revoke
  // and reissue tokens, creating a token revocation storm with autoRefreshToken.

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
  try {
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
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (
      message.toLowerCase().includes('invalid refresh token') ||
      message.toLowerCase().includes('auth session missing')
    ) {
      // Corrupted/expired token in storage; clear and reset state
      console.warn('[auth] clearing invalid stored session token:', message);

      // Sign out from Supabase client to stop auto-refresh attempts
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {
        // Ignore - we're already cleaning up
      }

      await clearAuthStorage();
      removeToken();
      stopIdleTimeout();
      set({
        status: 'signOut',
        token: null,
        user: null,
        session: null,
        lastValidatedAt: null,
        offlineMode: 'full',
      });
      return;
    }
    throw err;
  }
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
  await clearAuthStorage();
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
    // Check if current operation has been running too long
    if (authMutexSetAt && Date.now() - authMutexSetAt > 10000) {
      console.warn(
        '[auth] resetting stuck auth mutex (operation running >10s)'
      );
      // Capture the stuck operation's ID and add to invalidated set
      // This prevents the stuck operation from interfering when it eventually completes
      const stuckOperationId = authMutexOperationId;
      if (stuckOperationId !== null) {
        invalidatedOperationIds.push(stuckOperationId);
        // Limit array size to prevent memory growth - evict oldest (FIFO)
        while (invalidatedOperationIds.length > MAX_INVALIDATED_IDS) {
          invalidatedOperationIds.shift();
        }
      }
      set({ _authOperationInProgress: false });
      authMutexSetAt = null;
      authMutexOperationId = null;
      if (__DEV__ && stuckOperationId !== null) {
        console.log(`[auth] invalidated stuck operation #${stuckOperationId}`);
      }
      break;
    }
    // Only log mutex wait every 2 seconds to avoid console spam
    if (__DEV__ && Date.now() - lastMutexWaitLogTime > 2000) {
      console.log('[auth] waiting on auth mutex');
      lastMutexWaitLogTime = Date.now();
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  // Assign unique ID to this operation for proper cleanup tracking
  const myOperationId = ++authOperationIdCounter;
  set({ _authOperationInProgress: true });
  authMutexSetAt = Date.now();
  authMutexOperationId = myOperationId;

  try {
    return await operation();
  } finally {
    // Only release mutex if we still own it AND we weren't invalidated
    // This prevents stuck operations from interfering with new operations
    //
    // Use atomic check-and-remove pattern to prevent race condition:
    // The indexOf + splice pattern can race with the timeout handler that also
    // modifies invalidatedOperationIds. Instead, we atomically find and remove
    // in a single pass using findIndex + splice within the same synchronous block.
    // Since JS is single-threaded, this is safe as long as we don't yield between
    // the check and removal.
    let wasInvalidated = false;
    for (let i = 0; i < invalidatedOperationIds.length; i++) {
      if (invalidatedOperationIds[i] === myOperationId) {
        invalidatedOperationIds.splice(i, 1);
        wasInvalidated = true;
        break;
      }
    }

    if (wasInvalidated) {
      // This operation was invalidated due to timeout - already cleaned up from tracking
      if (__DEV__) {
        console.log(
          `[auth] operation #${myOperationId} was invalidated, skipping cleanup`
        );
      }
    } else if (authMutexOperationId === myOperationId) {
      set({ _authOperationInProgress: false });
      authMutexSetAt = null;
      authMutexOperationId = null;
    } else if (__DEV__) {
      console.log(
        `[auth] operation #${myOperationId} skipping cleanup (mutex owned by #${authMutexOperationId})`
      );
    }
  }
}

async function performSignIn(
  data: TokenType | { session: Session; user: User },
  get: () => AuthState,
  set: (state: Partial<AuthState>) => void
): Promise<void> {
  if (__DEV__) {
    console.log('[auth] performSignIn start');
  }
  await withAuthMutex(
    async () => {
      if ('session' in data && 'user' in data) {
        await handleSignInWithSession(data.session, data.user, set);
      } else {
        await handleSignInWithToken(data as TokenType, set);
      }

      if (__DEV__) {
        console.log('[auth] performSignIn complete');
      }
    },
    get,
    set
  );
}

async function handleSignedIn(
  session: Session,
  store: { get: () => AuthState; set: (state: Partial<AuthState>) => void }
) {
  const { get, set } = store;
  const currentState = get();
  // Only update if we're not already signed in with this session
  // Compare access tokens to detect session changes (e.g., OAuth refresh, multi-device)
  if (
    currentState.status !== 'signIn' ||
    !currentState.session ||
    currentState.session.access_token !== session.access_token
  ) {
    const token: TokenType = {
      access: session.access_token,
      refresh: session.refresh_token,
    };
    setToken(token);
    startIdleTimeout(() => _useAuth.getState().signOut());
    set({
      status: 'signIn',
      session,
      user: session.user,
      token,
      lastValidatedAt: Date.now(),
      offlineMode: 'full',
    });
  }
}

async function handleSignedOut(store: {
  get: () => AuthState;
  set: (state: Partial<AuthState>) => void;
}) {
  const { get, set } = store;
  // Handle SIGNED_OUT with race condition protection
  // Capture the session state BEFORE any work to detect sign-in during cleanup
  const stateBeforeCleanup = get();
  const cleanupStartTime = Date.now();

  // CRITICAL: Remove token synchronously FIRST, before async clearAuthStorage().
  // This prevents stale tokens persisting if SIGNED_IN fires during async cleanup.
  // If SIGNED_IN occurs after this point, it will write new tokens which is correct.
  removeToken();
  resetAgeGate();
  stopIdleTimeout();

  // Update state synchronously to reflect signed-out status immediately
  set({
    status: 'signOut',
    token: null,
    user: null,
    session: null,
    lastValidatedAt: null,
    offlineMode: 'full',
  });

  try {
    await clearAuthStorage();
  } catch (err) {
    console.error('[auth] Failed to clear auth storage on SIGNED_OUT:', err);
  }

  // RACE CONDITION CHECK: If a sign-in happened during async cleanup,
  // we don't need to do anything - the SIGNED_IN handler already set new tokens
  // and updated state. Our synchronous cleanup above was correct at the time,
  // and the new sign-in has since overwritten with valid data.
  const currentState = get();
  const signInOccurredDuringCleanup =
    currentState.status === 'signIn' ||
    (currentState.lastValidatedAt !== null &&
      currentState.lastValidatedAt > cleanupStartTime) ||
    (currentState.session !== null &&
      currentState.session !== stateBeforeCleanup.session);

  if (signInOccurredDuringCleanup && __DEV__) {
    console.log(
      '[auth] SIGNED_IN occurred during SIGNED_OUT cleanup - new session is active'
    );
  }
}

async function handleTokenRefreshed(
  session: Session,
  store: { get: () => AuthState; set: (state: Partial<AuthState>) => void }
) {
  const { get, set } = store;
  // Update session on token refresh - compare both tokens to detect actual changes
  // In OAuth refresh flows, refresh_token may stay the same while access_token changes
  const currentState = get();
  const currentAccessToken = currentState.token?.access;
  const currentRefreshToken = currentState.token?.refresh;

  // Skip only if BOTH tokens are identical (true duplicate event)
  if (
    currentAccessToken === session.access_token &&
    currentRefreshToken === session.refresh_token
  ) {
    return;
  }

  const token: TokenType = {
    access: session.access_token,
    refresh: session.refresh_token,
  };
  setToken(token);
  set({
    status: 'signIn',
    session,
    token,
    user: session.user ?? currentState.user,
    lastValidatedAt: Date.now(),
  });
}

async function handleAuthStateChange(
  event: AuthChangeEvent,
  session: Session | null,
  store: { get: () => AuthState; set: (state: Partial<AuthState>) => void }
) {
  const { set } = store;
  if (__DEV__) {
    console.log('[auth] onAuthStateChange', event, !!session);
  }

  // Handle SIGNED_IN events - update state and ensure status is set
  if (event === 'SIGNED_IN' && session) {
    await handleSignedIn(session, store);
  } else if (event === 'SIGNED_OUT') {
    await handleSignedOut(store);
  } else if (event === 'TOKEN_REFRESHED' && session) {
    await handleTokenRefreshed(session, store);
  } else if (event === 'USER_UPDATED' && session?.user) {
    set({ user: session.user });
  }
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
      try {
        await clearAuthStorage();
        await get().signOut();
      } catch (innerErr) {
        console.error('Auth hydration fallback signOut error:', innerErr);
      }
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
// NOTE: This listener handles auth events initiated by Supabase (auto-refresh, etc.)
// Our signIn/signOut functions update state directly - this listener syncs
// external changes. No mutex needed since Zustand setState is synchronous.
// The callback is async to properly await cleanup operations on SIGNED_OUT.
authSubscription = supabase.auth.onAuthStateChange(async (event, session) => {
  await withAuthMutex(
    async () => {
      await handleAuthStateChange(event, session, {
        get: _useAuth.getState,
        set: _useAuth.setState,
      });
    },
    _useAuth.getState,
    _useAuth.setState
  );
});

export const useAuth = createSelectors(_useAuth);

export const signOut = async () => await _useAuth.getState().signOut();
export const signIn = async (
  data: TokenType | { session: Session; user: User }
) => await _useAuth.getState().signIn(data);
export const hydrateAuth = async () => await _useAuth.getState().hydrate();

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

// Export cleanup function for testing/unmount scenarios
export const cleanupAuthListener = () => {
  authSubscription?.data.subscription.unsubscribe();
  authSubscription = null;
};

// HMR cleanup in development - automatically dispose listeners on module replacement
if (import.meta.hot) {
  import.meta.hot.dispose(cleanupAuthListener);
}

// Export functions used by sign-out hooks
export { resetAgeGate } from '../compliance/age-gate';
export { stopIdleTimeout } from './session-timeout';
export { removeToken } from './utils';
