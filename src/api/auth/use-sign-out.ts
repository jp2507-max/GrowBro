/**
 * Sign out hooks
 *
 * Provides React Query mutations for signing out:
 * - Sign out from current device (local scope)
 * - Sign out from all devices (global scope)
 */

import { createMutation } from 'react-query-kit';

import {
  removeToken,
  resetAgeGate,
  stopIdleTimeout,
  useAuth,
} from '@/lib/auth';
import { logAuthError, trackAuthEvent } from '@/lib/auth/auth-telemetry';
import { supabase } from '@/lib/supabase';

import { mapAuthError } from './error-mapper';

/**
 * Sign out from current device
 *
 * Signs out the user from the current device only. Other active sessions
 * on other devices remain active.
 *
 * Clears:
 * - Supabase session (local scope)
 * - MMKV storage (via useAuth.signOut)
 * - Zustand auth state
 * - Age gate verification status
 *
 * @example
 * const signOut = useSignOut();
 * await signOut.mutateAsync();
 */
export const useSignOut = createMutation({
  mutationKey: ['auth', 'sign-out'],
  mutationFn: async () => {
    const { error } = await supabase.auth.signOut({ scope: 'local' });

    if (error) {
      throw new Error(mapAuthError(error));
    }

    // Get current user info before clearing auth state
    const currentUser = useAuth.getState().user;

    // Clear local auth state (MMKV storage, age gate, idle timeout)
    removeToken();
    resetAgeGate();
    stopIdleTimeout();

    // Clear Zustand auth state
    useAuth.setState({
      status: 'signOut',
      token: null,
      user: null,
      session: null,
      lastValidatedAt: null,
      offlineMode: 'full',
    });

    // Track analytics event with consent checking and PII sanitization
    await trackAuthEvent('auth.sign_out', {
      scope: 'local',
      email: currentUser?.email,
      user_id: currentUser?.id,
    });
  },
  onError: async (error: Error) => {
    // Log error for debugging with consent checking
    await logAuthError(error, {
      errorKey: error.message,
      flow: 'sign_out',
      scope: 'local',
    });
  },
});

/**
 * Sign out from all devices
 *
 * Signs out the user from all devices globally. Revokes all active
 * refresh tokens across all sessions.
 *
 * Clears:
 * - All Supabase sessions (global scope)
 * - MMKV storage (via useAuth.signOut)
 * - Zustand auth state
 * - Age gate verification status
 *
 * Use this when:
 * - User suspects unauthorized access
 * - User wants to sign out everywhere (e.g., before account deletion)
 * - User lost a device and wants to revoke its access
 *
 * @example
 * const signOutGlobal = useSignOutGlobal();
 * await signOutGlobal.mutateAsync();
 */
export const useSignOutGlobal = createMutation({
  mutationKey: ['auth', 'sign-out-global'],
  mutationFn: async () => {
    const { error } = await supabase.auth.signOut({ scope: 'global' });

    if (error) {
      throw new Error(mapAuthError(error));
    }

    // Get current user info before clearing auth state
    const currentUser = useAuth.getState().user;

    // Clear local auth state
    // This also clears MMKV storage and resets age gate
    useAuth.getState().signOut();

    // Track analytics event with consent checking and PII sanitization
    await trackAuthEvent('auth.sign_out_global', {
      scope: 'global',
      email: currentUser?.email,
      user_id: currentUser?.id,
    });
  },
  onError: async (error: Error) => {
    // Log error for debugging with consent checking
    await logAuthError(error, {
      errorKey: error.message,
      flow: 'sign_out',
      scope: 'global',
    });
  },
});
