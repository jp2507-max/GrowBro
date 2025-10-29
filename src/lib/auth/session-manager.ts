import type { Session } from '@supabase/supabase-js';
import { useEffect } from 'react';

import { supabase } from '../supabase';
import type { OfflineMode } from './index';
import { useAuth } from './index';

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
      try {
        const { data, error } = await supabase.auth.refreshSession();

        if (error) {
          console.error('Session refresh error:', error);
          return null;
        }

        if (data.session) {
          // Update store with refreshed session
          const { updateSession } = useAuth.getState();
          updateSession(data.session);
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
      try {
        // Get the current session from Supabase
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error('Session validation error:', error);
          return false;
        }

        if (!session) {
          // No valid session, sign out
          const { signOut } = useAuth.getState();
          signOut();
          return false;
        }

        // Session is valid, update store
        const { updateSession } = useAuth.getState();
        updateSession(session);

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
export function useSessionAutoRefresh(
  refreshBeforeExpiry: number = 5 * 60 * 1000
): void {
  const session = useAuth.use.session();

  useEffect(() => {
    // Set up auto-refresh timer
    if (!session) return undefined;

    const timeUntilExpiry = sessionManager.getTimeUntilExpiry();
    if (timeUntilExpiry === null) return undefined;

    const timeUntilRefresh = Math.max(0, timeUntilExpiry - refreshBeforeExpiry);

    if (timeUntilRefresh <= 0 || timeUntilRefresh >= 24 * 60 * 60 * 1000) {
      // Skip if expired or refresh is more than 24 hours away
      return undefined;
    }

    // Only set timer if refresh is within 24 hours
    const timerId = setTimeout(async () => {
      await sessionManager.refreshSession();
    }, timeUntilRefresh);

    // Cleanup timer on unmount
    return () => {
      clearTimeout(timerId);
    };
  }, [session, refreshBeforeExpiry]);
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
