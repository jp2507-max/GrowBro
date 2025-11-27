/**
 * Account Deletion Request Hooks
 * Requirements: 6.5, 6.6, 6.12
 *
 * Initiates account deletion with grace period:
 * - Creates deletion request record in Supabase
 * - Schedules deletion for 30 days from now
 * - Logs audit entry
 * - Immediately logs out user and clears local data
 *
 * @example
 * const requestDeletion = useRequestAccountDeletion();
 * await requestDeletion.mutateAsync();
 */

import * as Crypto from 'expo-crypto';
import { createMutation } from 'react-query-kit';

import { getCurrentPolicyVersion } from '@/api/auth/account-deletion-helpers';
import { useAuth } from '@/lib/auth';
import { logAuthError, trackAuthEvent } from '@/lib/auth/auth-telemetry';
import { supabase } from '@/lib/supabase';
import type { AccountDeletionRequest } from '@/types/settings';

interface RequestAccountDeletionVariables {
  reason?: string;
}

interface RequestAccountDeletionResponse {
  success: boolean;
  requestId: string;
  scheduledFor: string;
}

interface DeletionRequestRecord {
  request_id: string;
  user_id: string;
  requested_at: string;
  scheduled_for: string;
  status: 'pending';
  reason?: string;
  policy_version: string;
}

/**
 * Request account deletion with 30-day grace period
 *
 * Creates a deletion request record and schedules the account for permanent
 * deletion in 30 days. User can cancel by logging in within the grace period.
 *
 * Flow:
 * 1. Generate unique request ID
 * 2. Create deletion request record in Supabase
 * 3. Log audit entry
 * 4. Log user out
 * 5. Clear all local data
 *
 * Requirements:
 * - 6.5: Initiate deletion process with request ID and timestamp
 * - 6.12: Create audit log entry
 */

// Helper function to create deletion request record
async function createDeletionRequest({
  requestId,
  userId,
  scheduledFor,
  policyVersion,
  reason,
}: {
  requestId: string;
  userId: string;
  scheduledFor: Date;
  policyVersion: string;
  reason?: string;
}): Promise<void> {
  const deletionRequest: DeletionRequestRecord = {
    request_id: requestId,
    user_id: userId,
    requested_at: new Date().toISOString(),
    scheduled_for: scheduledFor.toISOString(),
    status: 'pending',
    reason,
    policy_version: policyVersion,
  };

  const { error: insertError } = await supabase
    .from('account_deletion_requests')
    .insert(deletionRequest);

  if (insertError) {
    throw new Error(`settings.delete_account.error_create_request`);
  }
}

// Helper function to log audit entry
async function logDeletionAudit({
  userId,
  requestId,
  scheduledFor,
  policyVersion,
  reason,
}: {
  userId: string;
  requestId: string;
  scheduledFor: Date;
  policyVersion: string;
  reason?: string;
}): Promise<void> {
  const { error: auditError } = await supabase.from('audit_logs').insert({
    user_id: userId,
    event_type: 'account_deletion_requested',
    payload: {
      requestId,
      scheduledFor: scheduledFor.toISOString(),
      reason: reason || 'Not provided',
    },
    policy_version: policyVersion,
    app_version: process.env.EXPO_PUBLIC_VERSION || '1.0.0',
  });

  if (auditError) {
    throw auditError;
  }
}

// Helper function to handle audit logging failure
async function handleAuditLogFailure(
  requestId: string,
  userId: string,
  auditError: unknown
): Promise<void> {
  // Clean up the deletion request since audit logging failed
  const { error: cleanupError } = await supabase
    .from('account_deletion_requests')
    .delete()
    .eq('request_id', requestId);

  if (cleanupError) {
    console.warn(
      '[handleAuditLogFailure] Failed to clean up deletion request:',
      cleanupError
    );
  }

  const errorMessage =
    auditError instanceof Error ? auditError.message : String(auditError);

  await logAuthError(
    new Error(
      `settings.delete_account.error_audit_log_failed: ${errorMessage}`
    ),
    {
      errorKey: 'settings.delete_account.error_audit_log_failed',
      flow: 'request_account_deletion',
      requestId,
      userId,
      auditError: errorMessage,
    }
  );
  throw new Error('settings.delete_account.error_audit_log_failed');
}

export const useRequestAccountDeletion = createMutation({
  mutationKey: ['settings', 'request-account-deletion'],
  mutationFn: async (
    variables: RequestAccountDeletionVariables = {}
  ): Promise<RequestAccountDeletionResponse> => {
    const { user } = useAuth.getState();

    if (!user) {
      throw new Error('auth.error_not_authenticated');
    }

    // Generate request ID and scheduled date
    const requestId = Crypto.randomUUID();
    const scheduledFor = new Date();
    scheduledFor.setDate(scheduledFor.getDate() + 30);

    // Get policy version and create request
    const policyVersion = await getCurrentPolicyVersion();

    await createDeletionRequest({
      requestId,
      userId: user.id,
      scheduledFor,
      policyVersion,
      reason: variables.reason,
    });

    // Log audit entry with error handling
    try {
      await logDeletionAudit({
        userId: user.id,
        requestId,
        scheduledFor,
        policyVersion,
        reason: variables.reason,
      });
    } catch (auditError) {
      await handleAuditLogFailure(requestId, user.id, auditError);
    }

    // Track analytics event
    await trackAuthEvent('auth_account_deletion_requested', {
      user_id: user.id,
      email: user.email,
    });

    return {
      success: true,
      requestId,
      scheduledFor: scheduledFor.toISOString(),
    };
  },
  onError: async (error: Error) => {
    await logAuthError(error, {
      errorKey: error.message,
      flow: 'request_account_deletion',
    });
  },
});

/**
 * Check if user has a pending deletion request
 *
 * Used to show restore banner on login
 * Requirements: 6.7, 6.9
 */
export async function checkPendingDeletion(
  userId: string
): Promise<AccountDeletionRequest | null> {
  const { data, error } = await supabase
    .from('account_deletion_requests')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .single();

  if (error || !data) {
    return null;
  }

  return {
    requestId: data.request_id,
    userId: data.user_id,
    requestedAt: data.requested_at,
    scheduledFor: data.scheduled_for,
    status: data.status,
    reason: data.reason ?? undefined,
    policyVersion: data.policy_version,
  };
}

/**
 * Cancel a pending deletion request
 *
 * Allows user to restore their account within the grace period
 * Requirements: 6.7, 6.9
 */
export const useCancelAccountDeletion = createMutation({
  mutationKey: ['settings', 'cancel-account-deletion'],
  mutationFn: async (): Promise<{ success: boolean }> => {
    const { user } = useAuth.getState();

    if (!user) {
      throw new Error('auth.error_not_authenticated');
    }

    // Find pending deletion request
    const { data: deletionRequest, error: fetchError } = await supabase
      .from('account_deletion_requests')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .single();

    if (fetchError || !deletionRequest) {
      throw new Error('settings.delete_account.error_no_pending_request');
    }

    // Update status to cancelled
    const { error: updateError } = await supabase
      .from('account_deletion_requests')
      .update({ status: 'cancelled' })
      .eq('request_id', deletionRequest.request_id);

    if (updateError) {
      throw new Error('settings.delete_account.error_cancel_request');
    }

    // Log audit entry
    const { error: auditError } = await supabase.from('audit_logs').insert({
      user_id: user.id,
      event_type: 'account_deletion_cancelled',
      payload: {
        requestId: deletionRequest.request_id,
        cancelledAt: new Date().toISOString(),
      },
      policy_version: deletionRequest.policy_version,
      app_version: process.env.EXPO_PUBLIC_VERSION || '1.0.0',
    });

    if (auditError) {
      // Rollback status to pending since audit logging failed
      const { error: rollbackError } = await supabase
        .from('account_deletion_requests')
        .update({ status: 'pending' })
        .eq('request_id', deletionRequest.request_id);

      if (rollbackError) {
        console.warn(
          '[useCancelAccountDeletion] Failed to rollback status:',
          rollbackError
        );
      }

      await logAuthError(
        new Error(
          `settings.delete_account.error_audit_log_failed: ${auditError.message}`
        ),
        {
          errorKey: 'settings.delete_account.error_audit_log_failed',
          flow: 'cancel_account_deletion',
          requestId: deletionRequest.request_id,
          userId: user.id,
          auditError: auditError.message,
        }
      );
      throw new Error('settings.delete_account.error_audit_log_failed');
    }

    // Track analytics event
    await trackAuthEvent('auth_account_deletion_cancelled', {
      user_id: user.id,
      email: user.email,
    });

    return { success: true };
  },
  onError: async (error: Error) => {
    await logAuthError(error, {
      errorKey: error.message,
      flow: 'cancel_account_deletion',
    });
  },
});
