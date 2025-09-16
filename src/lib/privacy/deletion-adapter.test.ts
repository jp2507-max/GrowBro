import { appendAudit, getAuditLog } from '@/lib/privacy/audit-log';
import { setDeletionAdapter } from '@/lib/privacy/deletion-adapter';
import {
  addRetentionRecord,
  type RetentionRecord,
  retentionWorker,
} from '@/lib/privacy/retention-worker';

describe('DeletionAdapter integration', () => {
  test('invokes adapter for image cascades and writes audit', async () => {
    let inferenceCalls = 0;
    let trainingCalls = 0;
    setDeletionAdapter({
      async purgeInferenceImages() {
        inferenceCalls += 1;
        return 2;
      },
      async purgeTrainingImages() {
        trainingCalls += 1;
        return 1;
      },
    });

    const now = Date.now();
    const oldInf: RetentionRecord = {
      id: 'i1',
      dataType: 'inference_images',
      createdAt: now - 2 * 24 * 60 * 60 * 1000,
    };
    const oldTrain: RetentionRecord = {
      id: 't1',
      dataType: 'training_images',
      createdAt: now - 366 * 24 * 60 * 60 * 1000,
    };
    addRetentionRecord(oldInf);
    addRetentionRecord(oldTrain);

    const report = retentionWorker.runNow();
    expect(report.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ dataType: 'inference_images' }),
        expect.objectContaining({ dataType: 'training_images' }),
      ])
    );

    // Allow async adapter callbacks to flush
    await new Promise((r) => setTimeout(r, 10));

    expect(inferenceCalls).toBe(1);
    expect(trainingCalls).toBe(1);

    const log = getAuditLog();
    expect(
      log.some(
        (e) =>
          e.action === 'retention-delete' && e.dataType === 'inference_images'
      )
    ).toBe(true);
    expect(
      log.some(
        (e) =>
          e.action === 'retention-delete' && e.dataType === 'training_images'
      )
    ).toBe(true);

    // keep linter happy about unused import
    appendAudit({
      action: 'retention-delete',
      dataType: 'telemetry_raw',
      count: 0,
    });
  });
});
