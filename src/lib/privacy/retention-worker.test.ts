import { getAuditLog, validateAuditChain } from '@/lib/privacy/audit-log';
import {
  addRetentionRecord,
  getLastPurgeReport,
  type RetentionRecord,
  retentionWorker,
} from '@/lib/privacy/retention-worker';

afterEach(() => {
  // cleanup is automatic in our test setup; avoid manual cleanup per lint rule
});

function msDays(days: number): number {
  return days * 24 * 60 * 60 * 1000;
}

describe('RetentionWorker: telemetry raw', () => {
  test('purges expired telemetry_raw and records report', () => {
    const now = Date.now();
    const fresh: RetentionRecord = {
      id: 'a',
      dataType: 'telemetry_raw',
      createdAt: now - msDays(10),
    };
    const old: RetentionRecord = {
      id: 'b',
      dataType: 'telemetry_raw',
      createdAt: now - msDays(200),
    };

    addRetentionRecord(fresh);
    addRetentionRecord(old);

    const report = retentionWorker.runNow();
    expect(report.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ dataType: 'telemetry_raw', purgedCount: 1 }),
      ])
    );

    const stored = getLastPurgeReport();
    expect(stored?.generatedAt).toBeGreaterThan(0);

    // Verify audit entries and chain integrity
    const audit = getAuditLog();
    expect(audit.length).toBeGreaterThan(0);
    expect(validateAuditChain()).toBe(true);
  });
});

describe('RetentionWorker: images', () => {
  test('purges expired inference/train images and triggers deletion adapter', async () => {
    let inf = 0;
    let trn = 0;
    const { setDeletionAdapter } = await import(
      '@/lib/privacy/deletion-adapter'
    );
    setDeletionAdapter({
      async purgeInferenceImages() {
        inf += 1;
        return 1;
      },
      async purgeTrainingImages() {
        trn += 1;
        return 1;
      },
    });

    const now = Date.now();
    const oldInf = {
      id: 'inf1',
      dataType: 'inference_images' as const,
      createdAt: now - msDays(2),
    };
    const oldTrn = {
      id: 'trn1',
      dataType: 'training_images' as const,
      createdAt: now - msDays(366),
    };
    addRetentionRecord(oldInf);
    addRetentionRecord(oldTrn);

    const report = retentionWorker.runNow();
    expect(report.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ dataType: 'inference_images' }),
        expect.objectContaining({ dataType: 'training_images' }),
      ])
    );
    await new Promise((r) => setTimeout(r, 5));
    expect(inf).toBe(1);
    expect(trn).toBe(1);
  });
});
