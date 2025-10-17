/**
 * Hook: useOfflineStatus
 *
 * Simplified wrapper around useNetworkStatus for checking offline state.
 * Provides boolean offline flag for UI indicators.
 *
 * Requirements: 7.4
 */

import { useNetworkStatus } from './use-network-status';

export function useOfflineStatus(): boolean {
  const { isInternetReachable } = useNetworkStatus();
  return !isInternetReachable;
}
