/**
 * Account Deletion Helpers
 * Utility functions for account deletion workflow
 */

import { Env } from '@env';

import { supabase } from '@/lib/supabase';

/**
 * Get current policy version from app_config
 * Falls back to '1.0.0' if no config exists or query fails
 */
export async function getCurrentPolicyVersion(): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('policy_version')
      .limit(1)
      .maybeSingle();

    // Check for errors or null data, then safely access policy_version
    if (error || !data) {
      console.warn(
        '[getCurrentPolicyVersion] No app_config found or query error:',
        error?.message
      );
      return '1.0.0';
    }

    return data.policy_version || '1.0.0';
  } catch (error) {
    console.error('[getCurrentPolicyVersion] Unexpected error:', error);
    return '1.0.0';
  }
}

/**
 * Build deletion request payload
 */
export function buildDeletionRequestPayload(options: {
  requestId: string;
  userId: string;
  reason?: string;
  policyVersion: string;
}) {
  const { requestId, userId, reason, policyVersion } = options;
  const now = new Date();
  const scheduledFor = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

  return {
    request_id: requestId,
    user_id: userId,
    requested_at: now.toISOString(),
    scheduled_for: scheduledFor.toISOString(),
    status: 'pending',
    reason: reason || null,
    policy_version: policyVersion,
  };
}

/**
 * Build audit payload for account deletion
 */
export function buildAuditPayload(options: {
  eventType: string;
  userId: string;
  requestId: string;
  payload: Record<string, unknown>;
}) {
  const { eventType, userId, requestId, payload } = options;
  return {
    user_id: userId,
    event_type: eventType,
    payload: {
      ...payload,
      requestId,
    },
    app_version: Env.VERSION,
  };
}

/**
 * Insert audit log entry
 */
export async function insertAuditLog(entry: {
  user_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  app_version: string;
}): Promise<void> {
  const { error } = await supabase.from('audit_logs').insert({
    ...entry,
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error('[insertAuditLog] Failed to insert audit log:', error);
    throw new Error('Failed to create audit log entry');
  }
}

/**
 * Track deletion analytics event
 */
export async function trackDeletionEvent(
  eventName: string,
  properties: Record<string, unknown>
): Promise<void> {
  // TODO: Implement analytics tracking when analytics service is available
  console.log('[trackDeletionEvent]', eventName, properties);
}
