import {
  generatePrivacyExport,
  generatePrivacyExportJson,
} from '@/lib/privacy/export-service';

const mockConsentState = {
  telemetry: true,
  experiments: false,
  cloudProcessing: true,
  aiTraining: false,
  aiModelImprovement: false,
  crashDiagnostics: true,
  version: '2025-09-01',
  timestamp: '2025-01-01T00:00:00.000Z',
  locale: 'en',
};

const mockPrivacyConsent = {
  analytics: true,
  crashReporting: false,
  personalizedData: false,
  sessionReplay: false,
  aiModelImprovement: false,
  lastUpdated: 1,
};

const mockAuditTrail = [
  {
    id: '1',
    t: 1,
    action: 'consent-block',
    prevHash: '0',
    hash: 'abc',
  },
];

const mockPolicies = [
  {
    dataType: 'telemetry_raw',
    retentionDays: 90,
    deletionMethod: 'aggregate',
  },
];

const mockRecords: any[] = [];

const mockReport = {
  generatedAt: 100,
  entries: [],
};

const mockEvents = [
  {
    name: 'perf_first_paint_ms',
    properties: { ms: 42 },
    timestamp: new Date('2025-10-13T12:00:00.000Z'),
    sessionId: 's',
    schemaVersion: 'telemetry.v1',
  },
];

jest.mock('@/lib/privacy/consent-service', () => ({
  ConsentService: {
    getConsents: jest.fn(async () => mockConsentState),
  },
}));

jest.mock('@/lib/privacy-consent', () => ({
  getPrivacyConsent: jest.fn(() => mockPrivacyConsent),
}));

jest.mock('@/lib/privacy/audit-log', () => ({
  getAuditLog: jest.fn(async () => mockAuditTrail),
}));

jest.mock('@/lib/privacy/retention-worker', () => ({
  getRetentionPolicies: jest.fn(() => mockPolicies),
  getRetentionRecords: jest.fn(async () => mockRecords),
  getLastPurgeReport: jest.fn(async () => mockReport),
}));

jest.mock('@/lib/privacy/telemetry-client', () => ({
  telemetryClient: {
    getBufferedEventsForExport: jest.fn(() => mockEvents),
  },
}));

describe('generatePrivacyExport', () => {
  it('aggregates consent, retention, telemetry, and assessment data', async () => {
    const bundle = await generatePrivacyExport();
    expect(bundle.consent.current).toEqual(mockConsentState);
    expect(bundle.consent.privacyPreferences).toEqual(mockPrivacyConsent);
    expect(bundle.consent.auditTrail).toEqual(mockAuditTrail);
    expect(bundle.retention.policies).toEqual(mockPolicies);
    expect(bundle.retention.records).toEqual(mockRecords);
    expect(bundle.retention.lastReport).toEqual(mockReport);
    expect(bundle.telemetry.bufferedEvents).toEqual(mockEvents);
    expect(bundle.assessments).toBeDefined();
    expect(bundle.assessments.totalCount).toBeGreaterThanOrEqual(0);
    expect(new Date(bundle.generatedAt).getTime()).not.toBeNaN();
  });

  it('serializes bundle to formatted JSON', async () => {
    const json = await generatePrivacyExportJson();
    expect(typeof json).toBe('string');
    const parsed = JSON.parse(json);
    expect(parsed.consent.current.telemetry).toBe(true);
  });
});
