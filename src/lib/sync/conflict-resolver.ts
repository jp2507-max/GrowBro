import { NoopAnalytics } from '@/lib/analytics';

export type ResolutionStrategy = 'server-lww' | 'needs-review' | 'field-level';

export type Conflict = {
  tableName: 'series' | 'tasks' | 'occurrence_overrides';
  recordId: string;
  localRecord: Record<string, unknown> | null;
  remoteRecord: Record<string, unknown> | null;
  conflictFields: string[];
  timestamp: Date;
};

export type ConflictResolver = {
  getResolutionStrategy(tableName: Conflict['tableName']): ResolutionStrategy;
  markForReview(conflicts: Conflict[]): Promise<void>;
  logConflict(conflict: Conflict): void;
};

function getResolutionStrategy(
  tableName: Conflict['tableName']
): ResolutionStrategy {
  // v1 keeps server as source of truth (LWW). Client may mark for review.
  if (tableName === 'tasks') return 'needs-review';
  return 'server-lww';
}

function diffConflictingFields(
  localRec: Record<string, unknown> | null,
  remoteRec: Record<string, unknown> | null
): string[] {
  if (!localRec || !remoteRec) return [];
  const fields = new Set<string>([
    ...Object.keys(localRec),
    ...Object.keys(remoteRec),
  ]);
  const out: string[] = [];
  for (const k of fields) {
    const l = (localRec as any)[k];
    const r = (remoteRec as any)[k];
    const lv = l instanceof Date ? l.toISOString() : l;
    const rv = r instanceof Date ? r.toISOString() : r;
    if (lv !== rv) out.push(k);
  }
  return out;
}

async function markForReview(conflicts: Conflict[]): Promise<void> {
  // Analytics only for now; UI marking is done at apply time in sync-engine
  try {
    for (const _c of conflicts) {
      await NoopAnalytics.track('sync_conflict', {
        table: _c.tableName,
        count: 1,
      });
    }
  } catch {}
}

function logConflict(conflict: Conflict): void {
  // Keep logs PII-light; rely on Analytics for counters, dev builds for console
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[Sync][Conflict]', {
      table: conflict.tableName,
      id: conflict.recordId,
      fields: conflict.conflictFields.slice(0, 8),
      at: conflict.timestamp.toISOString(),
    });
  }
}

export function createConflictResolver(): ConflictResolver {
  return {
    getResolutionStrategy,
    markForReview,
    logConflict,
  };
}

export function buildConflict(params: {
  tableName: Conflict['tableName'];
  recordId: string;
  localRecord: Record<string, unknown> | null;
  remoteRecord: Record<string, unknown> | null;
}): Conflict {
  const { tableName, recordId, localRecord, remoteRecord } = params;
  return {
    tableName,
    recordId,
    localRecord,
    remoteRecord,
    conflictFields: diffConflictingFields(localRecord, remoteRecord),
    timestamp: new Date(),
  };
}
