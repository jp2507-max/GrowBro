import type { Session } from '@supabase/supabase-js';
import React, { useEffect } from 'react';

import { supabase } from '../supabase';
import type { OfflineMode } from './index';
import { useAuth } from './index';
import { deriveSessionKey } from './utils';

type SupabaseRealtimePayload = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Record<string, unknown> | null;
  old: Record<string, unknown> | null;
};

/**
 * Session Manager
 *
 * Handles session validation, token refresh, and offline mode determination.
 * Coordinates with Supabase Auth to ensure sessions remain valid and manages
 * the offline experience based on session age.
 *
 * Offline Mode Rules:
 * - 0-7 days since last validation: full read/write access
 * - 7-30 days: read-only mode (mutations queued, show banner)
 * - 30+ days: blocked (force re-authentication on connectivity)
 */

export interface SessionManager {
  /**
   * Validates the current session and determines offline mode.
   * Checks the lastValidatedAt timestamp against current time.
   *
   * @returns The appropriate offline mode based on session age
   */
  validateSession(): Promise<OfflineMode>;

  /**
   * Refreshes the current session tokens if needed.
   * Uses Supabase's built-in refresh token logic.
   *
   * @returns The refreshed session or null if refresh failed
   */
  refreshSession(): Promise<Session | null>;

  /**
   * Checks if the current session is expired.
   * Compares session.expires_at with current time.
   *
   * @returns True if session is expired, false otherwise
   */
  isSessionExpired(): boolean;

  /**
   * Gets the time remaining until the session expires.
   *
   * @returns Milliseconds until expiry, or 0 if already expired
   */
  getTimeUntilExpiry(): number;

  /**
   * Forces a session validation with the Supabase server.
   * Used when connectivity is restored to validate the cached session.
   * Also checks if the session has been revoked remotely.
   *
   * @returns True if session is valid, false otherwise
   */
  forceValidation(): Promise<boolean>;
}

/**
 * Session age thresholds in milliseconds
 */
const SESSION_AGE_THRESHOLDS = {
  FULL_ACCESS: 7 * 24 * 60 * 60 * 1000, // 7 days
  READONLY_ACCESS: 30 * 24 * 60 * 60 * 1000, // 30 days
} as const;

/**
 * Creates a session manager instance
 */
// eslint-disable-next-line max-lines-per-function
function createSessionManager(): SessionManager {
  return {
    async validateSession(): Promise<OfflineMode> {
      const { lastValidatedAt, session } = useAuth.getState();

      // If no session, user is signed out
      if (!session) {
        return 'blocked';
      }

      // If never validated, assume full access (new session)
      if (!lastValidatedAt) {
        return 'full';
      }

      const now = Date.now();
      const sessionAge = now - lastValidatedAt;

      // Determine offline mode based on session age
      if (sessionAge < SESSION_AGE_THRESHOLDS.FULL_ACCESS) {
        return 'full';
      } else if (sessionAge < SESSION_AGE_THRESHOLDS.READONLY_ACCESS) {
        return 'readonly';
      } else {
        return 'blocked';
      }
    },

    async refreshSession(): Promise<Session | null> {
      // Get the current session before refresh to identify which record to update
      const { session: currentSession } = useAuth.getState();

      // Guard: Don't try to refresh if we don't have a session in Zustand
      if (!currentSession) {
        return null;
      }

      // Guard: Check if Supabase client actually has a session before refreshing
      try {
        const { data: currentData } = await supabase.auth.getSession();
        if (!currentData?.session) {
          // No session in Supabase client - don't try to refresh
          return null;
        }
      } catch {
        return null;
      }

      const oldSessionKey = await deriveSessionKey(
        currentSession.refresh_token
      );

      try {
        const { data, error } = await supabase.auth.refreshSession();

        if (error) {
          // Don't log AuthSessionMissingError - it's expected when signed out
          if (error.name !== 'AuthSessionMissingError') {
            console.error('Session refresh error:', error);
          }
          return null;
        }

        if (data.session) {
          // Update session record with new refresh token hash to prevent revocation bypass
          try {
            const newSessionKey = await deriveSessionKey(
              data.session.refresh_token
            );
            if (newSessionKey && oldSessionKey) {
              // Update the specific session record that matches the old session key
              // This ensures we update the correct record even with multiple active sessions
              const { error: updateError } = await supabase
                .from('user_sessions')
                .update({
                  session_key: newSessionKey,
                  last_active_at: new Date().toISOString(),
                })
                .eq('user_id', data.session.user.id)
                .eq('session_key', oldSessionKey) // Match the old session key
                .is('revoked_at', null); // Only update non-revoked sessions

              if (updateError) {
                console.warn(
                  'Failed to update session record after refresh:',
                  updateError
                );
                // Don't block refresh on update failure - graceful degradation
              }
            }
          } catch (updateError) {
            console.warn(
              'Error updating session record after refresh:',
              updateError
            );
            // Don't block refresh on update failure - graceful degradation
          }

          // Update store with refreshed session
          const { updateSession, updateLastValidatedAt } = useAuth.getState();
          await updateSession(data.session);
          updateLastValidatedAt();
          return data.session;
        }

        return null;
      } catch (error) {
        console.error('Session refresh exception:', error);
        return null;
      }
    },

    isSessionExpired(): boolean {
      const { session } = useAuth.getState();

      if (!session) {
        return true;
      }

      // Session expires_at is in Unix timestamp (seconds)
      const expiresAt = session.expires_at;
      if (!expiresAt) {
        // If no expiry, assume expired for safety
        return true;
      }

      const now = Math.floor(Date.now() / 1000);
      return now >= expiresAt;
    },

    getTimeUntilExpiry(): number {
      const { session } = useAuth.getState();

      if (!session || !session.expires_at) {
        return 0;
      }

      const now = Math.floor(Date.now() / 1000);
      const expiresAt = session.expires_at;
      const timeRemaining = (expiresAt - now) * 1000; // Convert to milliseconds

      return Math.max(0, timeRemaining);
    },

    async forceValidation(): Promise<boolean> {
      // Guard: Only validate if we expect to have a session
      const { session: storeSession, status } = useAuth.getState();
      if (status !== 'signIn' || !storeSession) {
        return false;
      }

      try {
        // Get the current session from Supabase
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          // Don't log expected errors during sign-out
          if (error.name !== 'AuthSessionMissingError') {
            console.error('Session validation error:', error);
          }
          return false;
        }

        if (!session) {
          // No valid session - this is expected if user just signed out
          return false;
        }

        // Check if session has been revoked remotely
        // This ensures that session revocation from other devices forces sign-out
        const sessionKey = await deriveSessionKey(session.refresh_token);

        const { data } = await supabase
          .from('user_sessions')
          .select('revoked_at')
          .eq('session_key', sessionKey)
          .maybeSingle();

        const isRevoked = !!data?.revoked_at;

        if (isRevoked) {
          console.log('[SessionManager] Session has been revoked, signing out');
          const { signOut } = useAuth.getState();
          await signOut();
          return false;
        }

        // Session is valid, update store
        const { updateSession, updateLastValidatedAt } = useAuth.getState();
        await updateSession(session);
        updateLastValidatedAt();

        return true;
      } catch (error) {
        console.error('Session validation exception:', error);
        return false;
      }
    },
  };
}

/**
 * Singleton session manager instance
 */
export const sessionManager = createSessionManager();

/**
 * Hook for automatic session refresh
 *
 * Sets up a timer to automatically refresh the session before it expires.
 * Should be called once in the app root (e.g., _layout.tsx).
 *
 * @param refreshBeforeExpiry - Milliseconds before expiry to trigger refresh (default: 5 minutes)
 */

const MIN_REFRESH_INTERVAL = 30000; // 30 seconds minimum between refreshes

export function useSessionAutoRefresh(
  refreshBeforeExpiry: number = 5 * 60 * 1000
): void {
  const session = useAuth.use.session();
  const status = useAuth.use.status();
  // Use a ref to track last refresh time per hook instance to avoid
  // global state race conditions when multiple instances or rapid navigation occurs
  const lastRefreshTimeRef = React.useRef(0);

  useEffect(() => {
    // Only refresh if signed in with a valid session
    if (status !== 'signIn' || !session) return undefined;

    const timeUntilExpiry = sessionManager.getTimeUntilExpiry();

    // Check if session is already expired or no expiry info
    if (timeUntilExpiry <= 0) {
      return undefined;
    }

    // If session expires soon (within threshold), schedule refresh
    // but respect the minimum interval to prevent loops
    if (timeUntilExpiry <= refreshBeforeExpiry) {
      const now = Date.now();
      const timeSinceLastRefresh = now - lastRefreshTimeRef.current;

      if (timeSinceLastRefresh < MIN_REFRESH_INTERVAL) {
        // Too soon since last refresh - skip to prevent loop
        return undefined;
      }

      // Schedule refresh with a small delay to batch rapid state changes
      const timerId = setTimeout(async () => {
        lastRefreshTimeRef.current = Date.now();
        await sessionManager.refreshSession();
      }, 1000);

      return () => clearTimeout(timerId);
    }

    const timeUntilRefresh = timeUntilExpiry - refreshBeforeExpiry;

    // Skip if refresh is more than 24 hours away
    if (timeUntilRefresh >= 24 * 60 * 60 * 1000) {
      return undefined;
    }

    // Set timer for future refresh
    const timerId = setTimeout(async () => {
      lastRefreshTimeRef.current = Date.now();
      await sessionManager.refreshSession();
    }, timeUntilRefresh);

    // Cleanup timer on unmount
    return () => {
      clearTimeout(timerId);
    };
  }, [session, status, refreshBeforeExpiry]);
}

/**
 * Hook for monitoring offline mode
 *
 * Automatically validates session and updates offline mode on interval.
 * Should be called once in the app root (e.g., _layout.tsx).
 *
 * @param checkInterval - Milliseconds between checks (default: 1 minute)
 */
export function useOfflineModeMonitor(checkInterval: number = 60 * 1000): void {
  useEffect(() => {
    // Validate on mount
    const validateAndUpdate = async () => {
      const mode = await sessionManager.validateSession();
      const { setOfflineMode } = useAuth.getState();
      setOfflineMode(mode);
    };

    // Initial validation
    void validateAndUpdate();

    // Set up interval for periodic validation
    const intervalId = setInterval(() => {
      void validateAndUpdate();
    }, checkInterval);

    // Cleanup interval on unmount
    return () => {
      clearInterval(intervalId);
    };
  }, [checkInterval]);
}

/**
 * Hook for real-time session revocation monitoring
 *
 * Subscribes to changes in user_sessions table and signs out if current session is revoked.
 * Provides immediate revocation enforcement when the app is online.
 */
export function useRealtimeSessionRevocation(): void {
  const session = useAuth.use.session();

  useEffect(() => {
    if (!session) return undefined;

    const getSessionKey = async () => {
      try {
        return await deriveSessionKey(session.refresh_token);
      } catch {
        return null;
      }
    };

    const setupSubscription = async () => {
      const sessionKey = await getSessionKey();
      if (!sessionKey) return;

      const channel = supabase
        .channel(`session-revocation-${session.user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'user_sessions',
            filter: `user_id=eq.${session.user.id}`,
          },
          (payload: SupabaseRealtimePayload) => {
            const newRecord = payload.new as {
              session_key?: string;
              revoked_at?: string | null;
            } | null;
            const oldRecord = payload.old as {
              revoked_at?: string | null;
            } | null;

            if (
              newRecord?.session_key === sessionKey &&
              newRecord.revoked_at &&
              !oldRecord?.revoked_at
            ) {
              console.log(
                '[RealtimeSessionRevocation] Session revoked, signing out'
              );
              const { signOut } = useAuth.getState();
              signOut();
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    const cleanup = setupSubscription();

    return () => {
      cleanup?.then((fn) => fn?.());
    };
  }, [session]);
}
