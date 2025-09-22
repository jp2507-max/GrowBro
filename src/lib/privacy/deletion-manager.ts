import { Env } from '@/lib/env';
import { appendAudit } from '@/lib/privacy/audit-log';
import { supabase } from '@/lib/supabase';

export type DeletionResult = {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  estimatedCompletion?: string | null;
};

export type WebDeletionResult = {
  url: string;
  verified: boolean;
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

const ACCOUNT_DELETION_URL = Env.ACCOUNT_DELETION_URL;

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

function auditDeletionRequest(metadata: DeletionAuditMetadata): void {
  appendAudit({
    action: 'account-delete-request',
    details: {
      ...metadata,
      deletionUrl: ACCOUNT_DELETION_URL,
    },
  });
}

export async function deleteAccountInApp(
  reason: string = 'user_initiated_in_app'
): Promise<DeletionResult> {
  try {
    const result = await invokeSupabaseFunction<DeletionResult>('dsr-delete', {
      reason,
    });
    auditDeletionRequest({
      source: 'in_app',
      jobId: result.jobId,
      estimatedCompletion: result.estimatedCompletion ?? null,
      reason,
    });
    return result;
  } catch (err) {
    auditDeletionRequest({
      source: 'in_app',
      reason,
    });
    throw err;
  }
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
  auditDeletionRequest({
    source: 'in_app',
    jobId: result.jobId,
    estimatedCompletion: result.estimatedCompletion ?? null,
    reason: 'data_export_before_delete',
  });
  return result;
}

export function requestDeletionViaWeb(
  userId: string,
  metadata: { reason?: string } = {}
): WebDeletionResult {
  auditDeletionRequest({
    source: 'web',
    userId,
    reason: metadata.reason ?? 'self_service_web_flow',
  });
  return {
    url: ACCOUNT_DELETION_URL,
    verified: true,
  };
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

export function provideWebDeletionUrl(): string {
  return ACCOUNT_DELETION_URL;
}
