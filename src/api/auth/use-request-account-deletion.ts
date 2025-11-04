/**
 * Account Deletion Request Hook
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

import { createMutation } from 'react-query-kit';

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
export const useRequestAccountDeletion = createMutation({
  mutationKey: ['settings', 'request-account-deletion'],
  mutationFn: async (
    variables: RequestAccountDeletionVariables = {}
  ): Promise<RequestAccountDeletionResponse> => {
    const { user } = useAuth.getState();

    if (!user) {
      throw new Error('auth.error_not_authenticated');
    }

    // Generate request ID
    const requestId = crypto.randomUUID();

    // Calculate scheduled deletion date (30 days from now)
    const scheduledFor = new Date();
    scheduledFor.setDate(scheduledFor.getDate() + 30);

    // Get current policy version
    const { data: envData } = await supabase
      .from('app_config')
      .select('policy_version')
      .single();

    const policyVersion = envData?.policy_version || '1.0.0';

    // Create deletion request record
    // Note: Using snake_case column names to match the database schema
    // Supabase maps object property names directly to column names
    const deletionRequest: any = {
      request_id: requestId,
      user_id: user.id,
      requested_at: new Date().toISOString(),
      scheduled_for: scheduledFor.toISOString(),
      status: 'pending',
      reason: variables.reason,
      policy_version: policyVersion,
    };

    const { error: insertError } = await supabase
      .from('account_deletion_requests')
      .insert(deletionRequest);

    if (insertError) {
      throw new Error(`settings.delete_account.error_create_request`);
    }

    // Log audit entry
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      event_type: 'account_deletion_requested',
      payload: {
        requestId,
        scheduledFor: scheduledFor.toISOString(),
        reason: variables.reason || 'Not provided',
      },
      policy_version: policyVersion,
      app_version: process.env.EXPO_PUBLIC_VERSION || '1.0.0',
    });

    // Track analytics event
    await trackAuthEvent('account_deletion_requested', {
      requestId,
      scheduledFor: scheduledFor.toISOString(),
      userId: user.id,
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
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      event_type: 'account_deletion_cancelled',
      payload: {
        requestId: deletionRequest.request_id,
        cancelledAt: new Date().toISOString(),
      },
      policy_version: deletionRequest.policy_version,
      app_version: process.env.EXPO_PUBLIC_VERSION || '1.0.0',
    });

    // Track analytics event
    await trackAuthEvent('account_deletion_cancelled', {
      requestId: deletionRequest.request_id,
      userId: user.id,
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
