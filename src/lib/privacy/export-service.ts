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
import { database } from '@/lib/watermelon';
import type { AssessmentModel } from '@/lib/watermelon-models/assessment';

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

export type AssessmentExportRecord = {
  id: string;
  plantId: string;
  status: string;
  modelVersion: string;
  predictedClass?: string;
  confidence?: number;
  consentedForTraining: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AssessmentExport = {
  records: AssessmentExportRecord[];
  totalCount: number;
};

export type PrivacyExportBundle = {
  generatedAt: string;
  consent: ConsentExport;
  retention: RetentionExport;
  telemetry: TelemetryExport;
  assessments: AssessmentExport;
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

  // Export assessment data (sanitized)
  const assessmentRecords = await database
    .get<AssessmentModel>('assessments')
    .query()
    .fetch();
  const assessments: AssessmentExport = {
    records: assessmentRecords.map((a) => ({
      id: a.id,
      plantId: a.plantId,
      status: a.status,
      modelVersion: a.modelVersion,
      predictedClass: (a as AssessmentModel).predictedClass,
      confidence:
        (a as AssessmentModel).calibratedConfidence ??
        (a as AssessmentModel).rawConfidence,
      consentedForTraining: (a as AssessmentModel).consentedForTraining,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    })),
    totalCount: assessmentRecords.length,
  };

  return {
    generatedAt: new Date().toISOString(),
    consent,
    retention,
    telemetry,
    assessments,
  };
}

export async function generatePrivacyExportJson(): Promise<string> {
  const bundle = await generatePrivacyExport();
  return JSON.stringify(bundle, null, 2);
}
