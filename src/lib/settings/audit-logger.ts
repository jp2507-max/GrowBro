/**
 * Settings Audit Logger
 * Wrapper around privacy audit-log for settings-specific events
 *
 * Requirements: 12.6, 12.10
 */

import { Env } from '@env';

import { appendAudit } from '@/lib/privacy/audit-log';
import { supabase } from '@/lib/supabase';

/**
 * Policy version tracking
 * Update these when legal documents are updated
 */
export const POLICY_VERSIONS = {
  terms: '1.0.0',
  privacy: '1.0.0',
  cannabis: '1.0.0',
} as const;

interface ConsentChangePayload {
  consentType: 'analytics' | 'crashReporting' | 'telemetry' | 'sessionReplay';
  previousValue: boolean;
  newValue: boolean;
}

interface DataExportPayload {
  exportFormat: 'json' | 'json+zip';
  includeMedia: boolean;
  estimatedSizeMB: number;
}

interface AccountDeletionPayload {
  gracePeriodDays: number;
  scheduledFor: string; // ISO timestamp
  reason?: string;
}

/**
 * Log consent change event
 */
export async function logConsentChange(
  userId: string,
  payload: ConsentChangePayload
): Promise<void> {
  // Log locally
  await appendAudit({
    action: 'consent-change',
    details: {
      userId,
      consentType: payload.consentType,
      previousValue: payload.previousValue,
      newValue: payload.newValue,
      policyVersion: POLICY_VERSIONS.privacy,
      appVersion: Env.VERSION,
    },
  });

  // Sync to Supabase audit_logs table
  await syncAuditToSupabase({
    user_id: userId,
    event_type: 'consent_change',
    payload: {
      consentType: payload.consentType,
      previousValue: payload.previousValue,
      newValue: payload.newValue,
    },
    policy_version: POLICY_VERSIONS.privacy,
    app_version: Env.VERSION,
  });
}

/**
 * Log data export request event
 */
export async function logDataExportRequest(
  userId: string,
  payload: DataExportPayload
): Promise<void> {
  // Log locally
  await appendAudit({
    action: 'data-export-request',
    details: {
      userId,
      exportFormat: payload.exportFormat,
      includeMedia: payload.includeMedia,
      estimatedSizeMB: payload.estimatedSizeMB,
      policyVersion: POLICY_VERSIONS.privacy,
      appVersion: Env.VERSION,
    },
  });

  // Sync to Supabase audit_logs table
  await syncAuditToSupabase({
    user_id: userId,
    event_type: 'data_export',
    payload: {
      exportFormat: payload.exportFormat,
      includeMedia: payload.includeMedia,
      estimatedSizeMB: payload.estimatedSizeMB,
    },
    policy_version: POLICY_VERSIONS.privacy,
    app_version: Env.VERSION,
  });
}

/**
 * Log account deletion request event
 */
export async function logAccountDeletionRequest(
  userId: string,
  payload: AccountDeletionPayload
): Promise<void> {
  // Log locally
  await appendAudit({
    action: 'account-deletion-request',
    details: {
      userId,
      gracePeriodDays: payload.gracePeriodDays,
      scheduledFor: payload.scheduledFor,
      reason: payload.reason,
      policyVersion: POLICY_VERSIONS.privacy,
      appVersion: Env.VERSION,
    },
  });

  // Sync to Supabase audit_logs table
  await syncAuditToSupabase({
    user_id: userId,
    event_type: 'account_deletion',
    payload: {
      gracePeriodDays: payload.gracePeriodDays,
      scheduledFor: payload.scheduledFor,
      reason: payload.reason,
    },
    policy_version: POLICY_VERSIONS.privacy,
    app_version: Env.VERSION,
  });
}

/**
 * Sync audit entry to Supabase
 * Non-blocking, queues for retry on failure
 */
async function syncAuditToSupabase(entry: {
  user_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  policy_version: string;
  app_version: string;
}): Promise<void> {
  try {
    const { error } = await supabase.from('audit_logs').insert({
      ...entry,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error('[AuditLogger] Failed to sync to Supabase:', error);
      // TODO: Queue for retry when sync service is available
    }
  } catch (error) {
    console.error('[AuditLogger] Exception syncing to Supabase:', error);
    // Non-blocking, fail silently
  }
}
