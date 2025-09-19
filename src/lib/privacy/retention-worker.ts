import { appendAudit } from '@/lib/privacy/audit-log';
import { anonymizeAndTruncate } from '@/lib/privacy/crash-store';
import { getDeletionAdapter } from '@/lib/privacy/deletion-adapter';
import { incrementAggregate } from '@/lib/privacy/telemetry-aggregates';
import { getItem, setItem } from '@/lib/storage';

export type RetainedDataType =
  | 'telemetry_raw'
  | 'telemetry_aggregated'
  | 'crash_logs'
  | 'training_images'
  | 'inference_images';

export type RetentionPolicy = {
  dataType: RetainedDataType;
  retentionDays: number;
  deletionMethod: 'hard-delete' | 'anonymize' | 'aggregate';
};

export type PurgeReportEntry = {
  dataType: RetainedDataType;
  purgedCount: number;
};

export type PurgeReport = {
  generatedAt: number; // ms
  entries: PurgeReportEntry[];
};

// Minimal in-memory store backed by MMKV for demo purposes
const STORE_KEY = 'privacy.retention.store.v1';
const REPORT_KEY = 'privacy.retention.report.v1';

export type RetentionRecord = {
  id: string;
  dataType: RetainedDataType;
  createdAt: number; // ms epoch
};

export function addRetentionRecord(record: RetentionRecord): void {
  const all = getItem<RetentionRecord[]>(STORE_KEY) ?? [];
  setItem(STORE_KEY, [...all, record]);
}

export function getRetentionRecords(): RetentionRecord[] {
  return getItem<RetentionRecord[]>(STORE_KEY) ?? [];
}

export function getLastPurgeReport(): PurgeReport | null {
  return getItem<PurgeReport>(REPORT_KEY);
}

export class RetentionWorker {
  private policies: RetentionPolicy[] = [
    {
      dataType: 'telemetry_raw',
      retentionDays: 90,
      deletionMethod: 'aggregate',
    },
    { dataType: 'crash_logs', retentionDays: 180, deletionMethod: 'anonymize' },
    {
      dataType: 'inference_images',
      retentionDays: 1,
      deletionMethod: 'hard-delete',
    },
    {
      dataType: 'training_images',
      retentionDays: 365,
      deletionMethod: 'hard-delete',
    },
  ];

  runNow(): PurgeReport {
    const now = Date.now();
    const cutoffByType = this.computeCutoffs(now);
    const { keep, purgedCounts } = this.partitionRecords(cutoffByType);
    setItem(STORE_KEY, keep);
    const entries = this.buildEntries(purgedCounts);
    this.emitAudits(entries, now);
    const report: PurgeReport = { generatedAt: now, entries };
    setItem(REPORT_KEY, report);
    return report;
  }

  private computeCutoffs(now: number): Map<RetainedDataType, number> {
    const map = new Map<RetainedDataType, number>();
    for (const p of this.policies) {
      map.set(p.dataType, now - p.retentionDays * 24 * 60 * 60 * 1000);
    }
    return map;
  }

  private partitionRecords(cutoffByType: Map<RetainedDataType, number>): {
    keep: RetentionRecord[];
    purgedCounts: Map<RetainedDataType, number>;
  } {
    const all = getRetentionRecords();
    const keep: RetentionRecord[] = [];
    const purgedCounts = new Map<RetainedDataType, number>();
    for (const rec of all) {
      const cutoff = cutoffByType.get(rec.dataType);
      const isExpired = cutoff !== undefined && rec.createdAt < cutoff;
      if (isExpired) {
        purgedCounts.set(
          rec.dataType,
          (purgedCounts.get(rec.dataType) ?? 0) + 1
        );
      } else {
        keep.push(rec);
      }
    }
    return { keep, purgedCounts };
  }

  private buildEntries(
    purgedCounts: Map<RetainedDataType, number>
  ): PurgeReportEntry[] {
    return Array.from(purgedCounts.entries()).map(
      ([dataType, purgedCount]) => ({
        dataType,
        purgedCount,
      })
    );
  }

  private emitAudits(entries: PurgeReportEntry[], now: number): void {
    for (const e of entries) {
      appendAudit({
        action: 'retention-delete',
        dataType: e.dataType,
        count: e.purgedCount,
      });
      if (e.dataType === 'telemetry_raw' && e.purgedCount > 0) {
        const bucket = new Date(now).toISOString().slice(0, 10);
        incrementAggregate(bucket, e.purgedCount);
        appendAudit({
          action: 'retention-aggregate',
          dataType: 'telemetry_aggregated',
          count: e.purgedCount,
          bucket,
        });
      }
      if (e.dataType === 'crash_logs' && e.purgedCount > 0) {
        const before = now - 180 * 24 * 60 * 60 * 1000;
        const changed = anonymizeAndTruncate(before);
        appendAudit({
          action: 'retention-anonymize',
          dataType: 'crash_logs',
          count: changed,
        });
      }
      if (e.dataType === 'inference_images' && e.purgedCount > 0) {
        void getDeletionAdapter()
          .purgeInferenceImages(e.purgedCount)
          .then((deleted) => {
            if (deleted > 0)
              appendAudit({
                action: 'retention-delete',
                dataType: 'inference_images',
                count: deleted,
              });
          })
          .catch(() => {});
      }
      if (e.dataType === 'training_images' && e.purgedCount > 0) {
        void getDeletionAdapter()
          .purgeTrainingImages(e.purgedCount)
          .then((deleted) => {
            if (deleted > 0)
              appendAudit({
                action: 'retention-delete',
                dataType: 'training_images',
                count: deleted,
              });
          })
          .catch(() => {});
      }
    }
  }
}

export const retentionWorker = new RetentionWorker();
