import { showMessage } from 'react-native-flash-message';

import type { TxKeyPath } from '@/lib/i18n';
import { translate } from '@/lib/i18n';

import {
  getBlockedMutationError,
  shouldBlockMutation,
} from './connectivity-handler';
import { useAuth } from './index';

/**
 * Hook to guard mutations against offline mode
 *
 * Returns a function that checks if a mutation should be blocked based on
 * the current offline mode. If blocked, shows an error message and returns true.
 *
 * Usage:
 * ```ts
 * const checkOfflineGuard = useOfflineGuard();
 *
 * const mutation = useMutation({
 *   mutationFn: async (data) => {
 *     if (checkOfflineGuard()) return; // Blocked
 *     // Proceed with mutation
 *   }
 * });
 * ```
 */
export function useOfflineGuard(isSensitiveOp: boolean = false) {
  const offlineMode = useAuth.use.offlineMode();

  return (): boolean => {
    const isBlocked = shouldBlockMutation(offlineMode, isSensitiveOp);

    if (isBlocked) {
      const errorKey = getBlockedMutationError(
        offlineMode,
        isSensitiveOp
      ) as TxKeyPath;
      showMessage({
        message: translate(errorKey),
        type: 'danger',
        duration: 3000,
      });
    }

    return isBlocked;
  };
}
