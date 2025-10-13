import { Env } from '@env';

import { appendAudit } from '@/lib/privacy/audit-log';
import { supabase } from '@/lib/supabase';

export type DeletionResult = {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  estimatedCompletion?: string | null;
};

export type AccessibilityStep = {
  id: string;
  description: string;
};

export type AccessibilityResult = {
  accessible: boolean;
  steps: AccessibilityStep[];
  stepCount: number;
  maxAllowed: number;
  reason?: string;
};

export type DeletionAuditMetadata = {
  source: 'in_app' | 'web';
  jobId?: string;
  estimatedCompletion?: string | null;
  userId?: string;
  reason?: string;
};

export const SETTINGS_PRIVACY_ROUTE = '/(app)/settings/privacy-and-data';
export const MAX_ALLOWED_TAPS = 3;

const DELETION_STEPS: AccessibilityStep[] = [
  {
    id: 'tab-settings',
    description: 'Open Settings tab from bottom navigation',
  },
  {
    id: 'screen-privacy-data',
    description: 'Tap Privacy & Data within Settings',
  },
  {
    id: 'action-delete-account',
    description: 'Tap Delete my account button',
  },
];

async function invokeSupabaseFunction<T>(
  name: string,
  body?: Record<string, unknown>
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, {
    body,
  });
  if (error) {
    throw new Error(error.message ?? `Failed to invoke ${name}`);
  }
  if (!data) {
    throw new Error(`No response payload from ${name}`);
  }
  return data as T;
}

async function auditDeletionRequest(
  metadata: DeletionAuditMetadata
): Promise<void> {
  await appendAudit({
    action: 'account-delete-request',
    details: {
      ...metadata,
      deletionUrl: provideWebDeletionUrl(),
    },
  });
}

async function queueDeletionRequest(
  reason: string,
  source: 'in_app' | 'web',
  metadata: Partial<Omit<DeletionAuditMetadata, 'source' | 'reason'>> = {}
): Promise<DeletionResult> {
  try {
    const result = await invokeSupabaseFunction<DeletionResult>('dsr-delete', {
      reason,
    });
    const normalized: DeletionResult = {
      jobId: result.jobId,
      status: result.status,
      estimatedCompletion: result.estimatedCompletion ?? null,
    };
    await auditDeletionRequest({
      source,
      jobId: normalized.jobId,
      estimatedCompletion: normalized.estimatedCompletion,
      reason,
      ...metadata,
    });
    return normalized;
  } catch (error) {
    await auditDeletionRequest({
      source,
      reason,
      ...metadata,
    });
    throw error;
  }
}

export async function deleteAccountInApp(
  reason: string = 'user_initiated_in_app'
): Promise<DeletionResult> {
  return queueDeletionRequest(reason, 'in_app');
}

export async function requestDataExport(
  options: {
    includeTelemetry?: boolean;
    includeCrash?: boolean;
    includeConsents?: boolean;
    locale?: string;
  } = {}
): Promise<DeletionResult> {
  const result = await invokeSupabaseFunction<DeletionResult>('dsr-export', {
    includeTelemetry: options.includeTelemetry ?? true,
    includeCrash: options.includeCrash ?? true,
    includeConsents: options.includeConsents ?? true,
    locale: options.locale,
  });
  await auditDeletionRequest({
    source: 'in_app',
    jobId: result.jobId,
    estimatedCompletion: result.estimatedCompletion ?? null,
    reason: 'data_export_before_delete',
  });
  return {
    jobId: result.jobId,
    status: result.status,
    estimatedCompletion: result.estimatedCompletion ?? null,
  };
}

export async function requestDeletionViaWeb(
  metadata: { reason?: string; userId?: string } = {}
): Promise<DeletionResult> {
  const { reason = 'web_self_service', userId } = metadata;
  return queueDeletionRequest(reason, 'web', { userId });
}

export function validateDeletionPathAccessibility(): AccessibilityResult {
  if (DELETION_STEPS.length > MAX_ALLOWED_TAPS) {
    return {
      accessible: false,
      steps: [...DELETION_STEPS],
      stepCount: DELETION_STEPS.length,
      maxAllowed: MAX_ALLOWED_TAPS,
      reason: 'Delete account flow exceeds allowed tap count',
    };
  }
  return {
    accessible: true,
    steps: [...DELETION_STEPS],
    stepCount: DELETION_STEPS.length,
    maxAllowed: MAX_ALLOWED_TAPS,
  };
}

export function provideWebDeletionUrl(): string | undefined {
  // NOTE: In Expo builds, only EXPO_PUBLIC_* environment variables are available at runtime.
  // Configure ACCOUNT_DELETION_URL as EXPO_PUBLIC_ACCOUNT_DELETION_URL in .env files
  // to ensure it's properly injected into the app bundle and accessible via Env.ACCOUNT_DELETION_URL.
  if (Env.ACCOUNT_DELETION_URL) {
    return Env.ACCOUNT_DELETION_URL;
  }

  try {
    const privacyPolicy = require('../../../compliance/privacy-policy.json');
    return privacyPolicy.accountDeletionUrl;
  } catch {
    return undefined;
  }
}
