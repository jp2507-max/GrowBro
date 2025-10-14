import type { AuditEntry } from '@/lib/privacy/audit-log';
import { getAuditLog } from '@/lib/privacy/audit-log';
import { ConsentService } from '@/lib/privacy/consent-service';
import type { ConsentState } from '@/lib/privacy/consent-types';
import {
  getLastPurgeReport,
  getRetentionPolicies,
  getRetentionRecords,
  type PurgeReport,
  type RetentionPolicy,
  type RetentionRecord,
} from '@/lib/privacy/retention-worker';
import {
  telemetryClient,
  type TelemetryEvent,
} from '@/lib/privacy/telemetry-client';
import { getPrivacyConsent } from '@/lib/privacy-consent';

export type ConsentExport = {
  current: ConsentState;
  privacyPreferences: ReturnType<typeof getPrivacyConsent>;
  auditTrail: AuditEntry[];
};

export type RetentionExport = {
  policies: RetentionPolicy[];
  records: RetentionRecord[];
  lastReport: PurgeReport | null;
};

export type TelemetryExport = {
  bufferedEvents: TelemetryEvent[];
};

export type PrivacyExportBundle = {
  generatedAt: string;
  consent: ConsentExport;
  retention: RetentionExport;
  telemetry: TelemetryExport;
};

export async function generatePrivacyExport(): Promise<PrivacyExportBundle> {
  const [consents, auditTrail, records, lastReport] = await Promise.all([
    ConsentService.getConsents(),
    getAuditLog(),
    getRetentionRecords(),
    getLastPurgeReport(),
  ]);

  const consent: ConsentExport = {
    current: consents,
    privacyPreferences: getPrivacyConsent(),
    auditTrail,
  };

  const retention: RetentionExport = {
    policies: getRetentionPolicies(),
    records,
    lastReport,
  };

  const telemetry: TelemetryExport = {
    bufferedEvents: telemetryClient.getBufferedEventsForExport(),
  };

  return {
    generatedAt: new Date().toISOString(),
    consent,
    retention,
    telemetry,
  };
}

export async function generatePrivacyExportJson(): Promise<string> {
  const bundle = await generatePrivacyExport();
  return JSON.stringify(bundle, null, 2);
}
