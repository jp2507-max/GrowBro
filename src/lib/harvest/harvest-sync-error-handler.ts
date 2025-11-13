/**
 * Harvest-specific sync error handler
 * Integrates with sync-engine.ts to handle harvest table sync errors
 * Requirements: 17.2, 17.3, 17.4, 17.5
 */

import { showMessage } from 'react-native-flash-message';

import { HarvestAuditStatuses } from '@/types/harvest';

import { database } from '../watermelon';
import type { HarvestModel } from '../watermelon-models/harvest';
import type { HarvestAuditModel } from '../watermelon-models/harvest-audit';
import {
  classifyError,
  createAuditNoteForRejection,
  handleHarvestError,
} from './harvest-error-handler';
import type { SyncRejection } from './harvest-error-types';
import { ERROR_CATEGORY } from './harvest-error-types';

/**
 * Handles sync errors for harvest tables with appropriate UI feedback
 * Requirement 17.2: Toast notifications for transient errors
 * Requirement 17.3: Persistent banners for non-transient errors
 */
export async function handleHarvestSyncError(
  error: unknown,
  t: (key: string, options?: Record<string, unknown>) => string
): Promise<void> {
  const classified = classifyError(error);
  const result = handleHarvestError(error, t);

  // Transient network errors: show toast (already shown by handler)
  if (
    classified.category === ERROR_CATEGORY.NETWORK &&
    classified.retryable &&
    result.shouldShowToast
  ) {
    // Toast already shown by handleNetworkError
    return;
  }

  // Persistent errors: banner will be shown by UI component
  // The UI should check for sync errors and display HarvestErrorBanner
  if (result.shouldShowBanner) {
    console.log('[HarvestSync] Persistent error requires banner', {
      message: result.bannerMessage,
      actions: result.actions?.map((a) => a.label),
    });
  }
}

/**
 * Attaches audit notes for server rejections during sync
 * Requirement 17.5: Audit notes on server rejections
 */
export async function attachAuditNoteForRejection(
  rejection: SyncRejection
): Promise<void> {
  try {
    const auditNote = createAuditNoteForRejection(rejection);

    await database.write(async () => {
      const harvestsCollection =
        database.collections.get<HarvestModel>('harvests');
      const auditsCollection =
        database.collections.get<HarvestAuditModel>('harvest_audits');

      // Find the harvest record
      const harvest = await harvestsCollection.find(rejection.recordId);

      // Create audit entry for the rejection
      // Note: Using STAGE_REVERT as closest semantic match for sync rejection
      await auditsCollection.create((audit) => {
        audit.harvestId = rejection.recordId;
        audit.action = 'stage_revert'; // Using STAGE_REVERT as closest semantic match
        audit.status = HarvestAuditStatuses.BLOCKED;
        audit.reason = auditNote;
        audit.performedAt = rejection.timestamp;
        audit.metadata = {
          errorCode: rejection.errorCode,
          errorMessage: rejection.errorMessage,
          serverResponse: rejection.serverResponse,
        };
      });

      // Optionally mark the harvest with conflict flag
      await harvest.update((h) => {
        h.conflictSeen = true;
      });
    });

    console.log('[HarvestSync] Audit note attached for rejection', {
      recordId: rejection.recordId,
      errorCode: rejection.errorCode,
    });
  } catch (err) {
    console.error('[HarvestSync] Failed to attach audit note', err);
  }
}

/**
 * Handles 413 Payload Too Large errors by splitting upload
 * Requirement 17.4: Map 413 to chunking photos/splitting payloads
 */
export async function handlePayloadTooLarge(
  harvestId: string,
  t: (key: string) => string
): Promise<void> {
  showMessage({
    message: t('harvest.errors.sync.payload_too_large'),
    type: 'warning',
    duration: 4000,
  });

  // TODO: Implement chunking logic in sync outbox
  // For now, log the issue
  console.log('[HarvestSync] Payload too large, need to split', { harvestId });
}

/**
 * Handles 401 Unauthorized errors by triggering re-auth
 * Requirement 17.4: Map 401 to re-auth action
 */
export function handleUnauthorized(
  t: (key: string) => string,
  onReAuth?: () => void
): void {
  showMessage({
    message: t('harvest.errors.sync.unauthorized'),
    type: 'danger',
    duration: 5000,
  });

  if (onReAuth) {
    onReAuth();
  } else {
    console.log('[HarvestSync] Re-auth required but no handler provided');
  }
}

/**
 * Handles 403 Permission Denied errors
 * Requirement 17.4: Map 403 to permission denied message
 */
export function handlePermissionDenied(t: (key: string) => string): void {
  showMessage({
    message: t('harvest.errors.sync.permission_denied'),
    type: 'danger',
    duration: 5000,
  });
}

/**
 * Handles 422 Validation errors from server
 * Requirement 17.4: Map 422 to validation error message
 */
export function handleValidationError(
  error: unknown,
  t: (key: string) => string
): void {
  const classified = classifyError(error);

  showMessage({
    message: t('harvest.errors.sync.validation_failed'),
    description: classified.message,
    type: 'danger',
    duration: 5000,
  });
}

/**
 * Handles 500 Server errors with retry
 * Requirement 17.4: Map 500 to retry action
 */
export function handleServerError(
  error: unknown,
  t: (key: string) => string
): void {
  const classified = classifyError(error);

  showMessage({
    message: t('harvest.errors.sync.server_error'),
    description: classified.message,
    type: 'warning',
    duration: 4000,
  });

  // Retry will be handled by sync engine's exponential backoff
}

/**
 * Route sync errors to appropriate handlers based on status code
 * Requirement 17.4: Server error code mapping
 */
export async function handleSyncErrorByCode(
  error: unknown,
  t: (key: string) => string,
  onReAuth?: () => void
): Promise<void> {
  const classified = classifyError(error);

  switch (classified.code) {
    case 401:
      handleUnauthorized(t, onReAuth);
      break;

    case 403:
      handlePermissionDenied(t);
      break;

    case 413:
      // Extract harvest ID from error context if available
      await handlePayloadTooLarge('unknown', t);
      break;

    case 422:
      handleValidationError(error, t);
      break;

    case 500:
    case 503:
      handleServerError(error, t);
      break;

    default:
      // Fall back to general error handling
      await handleHarvestSyncError(error, t);
  }
}
