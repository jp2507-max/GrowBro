import { useEffect } from 'react';

import { onConnectivityChange } from '../sync/network-manager';
import { useAuth } from './index';
import { sessionManager } from './session-manager';

/**
 * Connectivity Handler
 *
 * Monitors network connectivity changes and validates auth session when
 * connectivity is restored. Handles the transition from offline to online
 * by validating the cached session and flushing queued operations.
 *
 * This should be called once in the app root (e.g., _layout.tsx).
 */

/**
 * Hook to monitor connectivity changes and validate session on restore
 *
 * When connectivity changes from offline to online:
 * 1. Validates the cached session with Supabase
 * 2. Refreshes tokens if needed
 * 3. Updates offline mode based on validation result
 * 4. Flushes queued operations (handled by WatermelonDB sync)
 */
export function useConnectivityHandler(): void {
  const offlineMode = useAuth.use.offlineMode();

  useEffect(() => {
    let previouslyOnline = true;

    const unsubscribe = onConnectivityChange(async (networkState) => {
      const isOnline =
        networkState.isConnected && (networkState.isInternetReachable ?? true);

      // Detect transition from offline to online
      if (!previouslyOnline && isOnline) {
        console.log(
          '[ConnectivityHandler] Connectivity restored, validating session...'
        );

        // Force session validation with server
        const isValid = await sessionManager.forceValidation();

        if (isValid) {
          console.log('[ConnectivityHandler] Session validated successfully');

          // Update offline mode to full access
          const { setOfflineMode } = useAuth.getState();
          setOfflineMode('full');

          // Note: WatermelonDB sync queue flush is handled by the sync engine
          // which listens to connectivity changes independently
        } else {
          console.log(
            '[ConnectivityHandler] Session validation failed, user signed out'
          );
          // Session is invalid or expired, user has been signed out by forceValidation
        }
      }

      previouslyOnline = isOnline;
    });

    return () => {
      unsubscribe();
    };
  }, [offlineMode]);
}

/**
 * Check if a mutation should be blocked based on offline mode
 *
 * @param offlineMode - Current offline mode
 * @param _isSensitiveOp - Whether this is a sensitive operation (password/email change, account deletion)
 * @returns True if mutation should be blocked, false otherwise
 */
export function shouldBlockMutation(
  offlineMode: 'full' | 'readonly' | 'blocked',
  _isSensitiveOp: boolean = false
): boolean {
  // Block all mutations in blocked mode
  if (offlineMode === 'blocked') {
    return true;
  }

  // Block all mutations in readonly mode
  if (offlineMode === 'readonly') {
    return true;
  }

  // In full mode, allow all mutations
  // Note: Sensitive operations (password/email changes) should check network status separately
  return false;
}

/**
 * Get error message for blocked mutation
 *
 * @param offlineMode - Current offline mode
 * @param isSensitiveOp - Whether this is a sensitive operation
 * @returns Localized error message key
 */
export function getBlockedMutationError(
  offlineMode: 'full' | 'readonly' | 'blocked',
  isSensitiveOp: boolean = false
): string {
  if (offlineMode === 'blocked') {
    return 'errors.sync.unauthorized';
  }

  if (offlineMode === 'readonly') {
    return isSensitiveOp
      ? 'errors.sync.permission_denied'
      : 'errors.sync.network_timeout';
  }

  return 'errors.sync.unknown';
}
