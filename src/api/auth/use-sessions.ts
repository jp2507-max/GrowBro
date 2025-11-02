import { createMutation, createQuery } from 'react-query-kit';

import type { UserSession } from '@/api/auth';
import { checkSessionRevocation, deriveSessionKey } from '@/lib/auth/utils';
import { supabase } from '@/lib/supabase';

// Fetch active sessions for current user
export const useSessions = createQuery<UserSession[], void, Error>({
  queryKey: ['auth', 'sessions'],
  fetcher: async () => {
    const { data, error } = await supabase
      .from('user_sessions')
      .select('*')
      .is('revoked_at', null)
      .order('last_active_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data as UserSession[];
  },
});

// Revoke a specific session (via Edge Function)
export const useRevokeSession = createMutation<
  void,
  { sessionKey: string },
  Error
>({
  mutationFn: async ({ sessionKey }) => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      throw new Error('No active session');
    }

    // Call Edge Function via Supabase functions.invoke
    const { error } = await supabase.functions.invoke('revoke-session', {
      body: { sessionKey },
    });

    if (error) {
      throw new Error(error.message || 'Failed to revoke session');
    }
  },
});

// Revoke all other sessions (via Edge Function)
export const useRevokeAllOtherSessions = createMutation<void, void, Error>({
  mutationFn: async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      throw new Error('No active session');
    }

    // Derive current session key from refresh token
    const currentSessionKey = await deriveSessionKey(
      sessionData.session.refresh_token
    );
    if (!currentSessionKey) {
      throw new Error('Unable to derive session key');
    }

    // Call Edge Function via Supabase functions.invoke
    const { error } = await supabase.functions.invoke(
      'revoke-all-sessions-except',
      {
        body: { currentSessionKey },
      }
    );

    if (error) {
      throw new Error(error.message || 'Failed to revoke all sessions');
    }
  },
});

/**
 * Check if the current session has been revoked.
 * Used on app startup to force sign-out if session is revoked.
 *
 * @returns Query hook that checks if current session is revoked
 */
export const useCheckSessionRevocation = createQuery<boolean, void, Error>({
  queryKey: ['auth', 'session-revocation-check'],
  fetcher: async () => {
    // Get current session
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.refresh_token) {
      // No session to check
      return false;
    }

    // Use shared revocation checking logic
    return await checkSessionRevocation(sessionData.session.refresh_token);
  },
  // Don't run automatically, only when explicitly called
  enabled: false,
});
