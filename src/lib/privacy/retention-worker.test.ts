import { getAuditLog, validateAuditChain } from '@/lib/privacy/audit-log';
import {
  addRetentionRecord,
  getLastPurgeReport,
  type RetentionRecord,
  retentionWorker,
} from '@/lib/privacy/retention-worker';
import { clearSecureConfigForTests } from '@/lib/privacy/secure-config-store';

beforeEach(async () => {
  await clearSecureConfigForTests();
});

function msDays(days: number): number {
  return days * 24 * 60 * 60 * 1000;
}

describe('RetentionWorker: telemetry raw', () => {
  test('purges expired telemetry_raw and records report', async () => {
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

    await addRetentionRecord(fresh);
    await addRetentionRecord(old);

    const report = await retentionWorker.runNow();
    expect(report.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ dataType: 'telemetry_raw', purgedCount: 1 }),
      ])
    );

    const stored = await getLastPurgeReport();
    expect(stored?.generatedAt).toBeGreaterThan(0);

    // Verify audit entries and chain integrity
    const audit = await getAuditLog();
    expect(audit.length).toBeGreaterThan(0);
    expect(await validateAuditChain()).toBe(true);
  });
});

describe('RetentionWorker: images', () => {
  test('purges expired inference/train images and triggers deletion adapter', async () => {
    let inf = 0;
    let trn = 0;
    jest.isolateModules(() => {
      const { setDeletionAdapter } = require('@/lib/privacy/deletion-adapter');
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
    await addRetentionRecord(oldInf);
    await addRetentionRecord(oldTrn);

    const report = await retentionWorker.runNow();
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
