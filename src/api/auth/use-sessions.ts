import * as Crypto from 'expo-crypto';
import { createMutation, createQuery } from 'react-query-kit';

import type { UserSession } from '@/api/auth';
import { supabase } from '@/lib/supabase';

/**
 * Derives a stable session key from a refresh token.
 * Uses SHA-256 hash to create a consistent identifier.
 *
 * @param refreshToken - The refresh token to hash
 * @returns SHA-256 hash of the refresh token
 */
export async function deriveSessionKey(
  refreshToken: string | undefined
): Promise<string> {
  if (!refreshToken) return '';

  // Use SHA-256 to create a stable, non-reversible identifier
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    refreshToken
  );
  return hash;
}

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

    // Derive session key from current refresh token
    const sessionKey = await deriveSessionKey(
      sessionData.session.refresh_token
    );
    if (!sessionKey) {
      return false;
    }

    // Check if this session key is revoked in user_sessions table
    const { data, error } = await supabase
      .from('user_sessions')
      .select('revoked_at')
      .eq('session_key', sessionKey)
      .maybeSingle();

    if (error) {
      console.error('Session revocation check error:', error);
      // Don't block user on error
      return false;
    }

    // Session is revoked if data exists and revoked_at is not null
    return !!data?.revoked_at;
  },
  // Don't run automatically, only when explicitly called
  enabled: false,
});
