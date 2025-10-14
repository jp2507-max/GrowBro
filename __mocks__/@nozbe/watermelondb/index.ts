// Main WatermelonDB mock for Jest with simple in-memory persistence
import SQLiteAdapterMock from './adapters/sqlite';

// Mock model interface for methods that use 'this'
interface MockModel {
  update(callback: (model: this) => void | Promise<void>): Promise<void>;
  deliveredAtLocal?: number;
  acknowledgedAt?: number;
  resolvedAt?: number;
}

// Utilities
let idCounter = 0;
function makeId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

function mapFieldName(field: string): string {
  switch (field) {
    case 'series_id':
      return 'seriesId';
    case 'occurrence_local_date':
      return 'occurrenceLocalDate';
    case 'deleted_at':
      return 'deletedAt';
    default:
      return field;
  }
}

type WhereCond =
  | { key: string; value: any }
  | { key: string; $oneOf: any[] }
  | { key: string; $notEq: any }
  | { key: string; $gte: any }
  | { key: string; $lte: any }
  | { key: string; $like: string };

// Minimal Model base class so modelClasses can extend it without side effects
export class Model {}

// Mock Q (Query) builder with only what we use
export const Q = {
  asc: 'asc',
  desc: 'desc',
  where(key: string, value: any): WhereCond {
    if (typeof value === 'object' && value && '$oneOf' in value) {
      return { key, $oneOf: value.$oneOf };
    }
    if (typeof value === 'object' && value && '$notEq' in value) {
      return { key, $notEq: value.$notEq };
    }
    if (typeof value === 'object' && value && '$gte' in value) {
      return { key, $gte: value.$gte };
    }
    if (typeof value === 'object' && value && '$lte' in value) {
      return { key, $lte: value.$lte };
    }
    if (typeof value === 'object' && value && '$like' in value) {
      return { key, $like: value.$like };
    }
    return { key, value };
  },
  notEq(value: any): { $notEq: any } {
    return { $notEq: value };
  },
  oneOf(values: any[]): { $oneOf: any[] } {
    return { $oneOf: values };
  },
  like(pattern: string): { $like: string } {
    return { $like: pattern };
  },
  gte(value: any): { $gte: any } {
    return { $gte: value };
  },
  lte(value: any): { $lte: any } {
    return { $lte: value };
  },
  sortBy(
    key: string,
    direction: 'asc' | 'desc' = 'asc'
  ): { $sortBy: { key: string; direction: 'asc' | 'desc' } } {
    return { $sortBy: { key, direction } };
  },
  take(count: number): { $take: number } {
    return { $take: count };
  },
};

function createMockRecord(): any {
  // Define the record first so closures below capture the correct instance
  const rec: any = { id: makeId('id'), _raw: {} };

  rec.update = async (fn: (rec2: any) => void) => {
    await fn(rec);
    rec.updatedAt = new Date();
    return rec;
  };

  rec.markAsDeleted = async () => {
    rec.deletedAt = new Date();
    return rec;
  };

  rec.destroyPermanently = jest.fn().mockResolvedValue(undefined);

  return rec;
}

function applyRecordDefaults(rec: any): void {
  rec.createdAt = rec.createdAt ?? new Date();
  rec.updatedAt = rec.updatedAt ?? new Date();
}

function filterResults(store: any[], filters: WhereCond[]): any[] {
  return store.filter((row) =>
    filters.every((c) => {
      const key = mapFieldName(c.key);
      if ('$oneOf' in c) {
        return c.$oneOf.includes((row as any)[key]);
      } else if ('$notEq' in c) {
        return (row as any)[key] !== c.$notEq;
      } else if ('$gte' in c) {
        return (row as any)[key] >= c.$gte;
      } else if ('$lte' in c) {
        return (row as any)[key] <= c.$lte;
      } else if ('$like' in c) {
        // For metadata field, convert object to JSON string for like comparison
        let rowValue = (row as any)[key];
        if (key === 'metadata' && typeof rowValue === 'object') {
          rowValue = JSON.stringify(rowValue);
        }
        rowValue = String(rowValue);
        // Convert SQL LIKE pattern to RegExp: % -> .*, _ -> ., escape other special chars
        const regexPattern = c.$like
          .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // escape regex special chars
          .replace(/%/g, '.*') // % matches any sequence
          .replace(/_/g, '.'); // _ matches single char
        const regex = new RegExp(`^${regexPattern}$`, 'i');
        return regex.test(rowValue);
      } else {
        return (row as any)[key] === c.value;
      }
    })
  );
}

function sortResults(
  results: any[],
  sortBy: { key: string; direction: 'asc' | 'desc' }
): any[] {
  return results.sort((a, b) => {
    const aVal = (a as any)[sortBy.key];
    const bVal = (b as any)[sortBy.key];
    const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    return sortBy.direction === 'desc' ? -cmp : cmp;
  });
}

function limitResults(results: any[], take: number): any[] {
  return results.slice(0, take);
}

function createPlaceholderRecord(id: string): any {
  // Same pattern as above: create object first, then attach methods
  const rec: any = { id, _raw: {} };

  rec.update = async (fn: (rec2: any) => void) => {
    await fn(rec);
    rec.updatedAt = new Date();
    return rec;
  };

  rec.markAsDeleted = async () => {
    rec.deletedAt = new Date();
    return rec;
  };

  return rec as any;
}

// Query chain builder for makeCollection
function buildQueryChain(
  store: any[],
  initialConds: (
    | WhereCond
    | { $sortBy: { key: string; direction: 'asc' | 'desc' } }
    | { $take: number }
  )[]
) {
  const allConditions: typeof initialConds = [...initialConds];

  const chain = {
    where: (k: string, v: any) => {
      allConditions.push(Q.where(k, v));
      return chain;
    },
    sortBy: (k: string, dir: 'asc' | 'desc' | typeof Q.asc | typeof Q.desc) => {
      let direction: 'asc' | 'desc';
      if (dir === Q.asc || dir === 'asc') {
        direction = 'asc';
      } else if (dir === Q.desc || dir === 'desc') {
        direction = 'desc';
      } else {
        direction = 'asc'; // default to ascending
      }
      allConditions.push({
        $sortBy: { key: k, direction },
      });
      return chain;
    },
    take: (count: number) => {
      allConditions.push({ $take: count });
      return chain;
    },
    async fetch() {
      const filters = allConditions.filter((c) => 'key' in c) ?? [];
      const sortBy = allConditions.find((c) => '$sortBy' in c)?.$sortBy;
      const take = allConditions.find((c) => '$take' in c)?.$take;

      let results = filterResults(store, filters);

      if (sortBy) {
        results = sortResults(results, sortBy);
      }

      if (take) {
        results = limitResults(results, take);
      }

      return results;
    },
  } as const;
  return chain;
}

// Generic collection factory
function makeCollection(initial: any[] = []) {
  const store: any[] = [...initial];

  function findIndexById(id: string): number {
    return store.findIndex((r) => r.id === id);
  }

  return {
    async create(cb: (rec: any) => void | Promise<void>) {
      const rec = createMockRecord();
      if (cb) await cb(rec);
      applyRecordDefaults(rec);
      store.push(rec);
      return rec;
    },
    query: (...initialConds: Parameters<typeof buildQueryChain>[1]) =>
      buildQueryChain(store, initialConds),
    async find(id: string) {
      const idx = findIndexById(id);
      if (idx === -1) {
        const rec = createPlaceholderRecord(id);
        store.push(rec);
        return rec;
      }
      return store[idx];
    },
    __store: store,
  };
}

// Domain-specific collections with defaults
function buildTasksCollection() {
  const col = makeCollection();
  // Wrap create to apply task defaults
  const originalCreate = col.create.bind(col);
  col.create = async (cb: any) => {
    return originalCreate(async (rec: any) => {
      rec.title = '';
      rec.description = '';
      rec.dueAtLocal = new Date().toISOString();
      rec.dueAtUtc = new Date().toISOString();
      rec.timezone = 'UTC';
      rec.reminderAtLocal = null;
      rec.reminderAtUtc = null;
      rec.status = 'pending';
      rec.metadata = {};
      rec.createdAt = new Date();
      rec.updatedAt = new Date();
      rec.deletedAt = null;
      await cb?.(rec);
    });
  };
  return col;
}

function buildSeriesCollection() {
  const col = makeCollection();
  const originalCreate = col.create.bind(col);
  col.create = async (cb: any) => {
    return originalCreate(async (rec: any) => {
      rec.title = 'series';
      rec.description = '';
      rec.dtstartLocal = new Date().toISOString();
      rec.dtstartUtc = new Date().toISOString();
      rec.timezone = 'UTC';
      rec.rrule = 'FREQ=DAILY';
      rec.untilUtc = null;
      rec.plantId = null;
      rec.createdAt = new Date();
      rec.updatedAt = new Date();
      rec.deletedAt = null;
      await cb?.(rec);
    });
  };
  return col;
}

function buildOverridesCollection() {
  const col = makeCollection();
  const originalCreate = col.create.bind(col);
  col.create = async (cb: any) => {
    return originalCreate(async (rec: any) => {
      rec.seriesId = 'mock-series-id';
      rec.occurrenceLocalDate = '2025-01-01';
      rec.status = 'reschedule';
      rec.dueAtLocal = null;
      rec.dueAtUtc = null;
      rec.reminderAtLocal = null;
      rec.reminderAtUtc = null;
      rec.createdAt = new Date();
      rec.updatedAt = new Date();
      await cb?.(rec);
    });
  };
  return col;
}

function buildUploadQueueCollection() {
  const col = makeCollection();
  return col;
}

function buildNotificationPreferencesCollection() {
  const col = makeCollection();
  const originalCreate = col.create.bind(col);
  col.create = async (cb: any) => {
    return originalCreate(async (rec: any) => {
      rec.userId = '';
      rec.communityInteractions = true;
      rec.communityLikes = true;
      rec.cultivationReminders = true;
      rec.systemUpdates = true;
      rec.quietHoursEnabled = false;
      rec.quietHoursStart = null;
      rec.quietHoursEnd = null;
      rec.updatedAt = new Date();
      await cb?.(rec);
    });
  };
  return col;
}

function buildHarvestsCollection() {
  const col = makeCollection();
  const originalCreate = col.create.bind(col);
  col.create = async (cb: any) => {
    return originalCreate(async (rec: any) => {
      rec.plantId = 'mock-plant-id';
      rec.stage = 'harvest';
      rec.wetWeightG = null;
      rec.dryWeightG = null;
      rec.trimmingsWeightG = null;
      rec.notes = '';
      rec.photos = [];
      rec.stageStartedAt = new Date();
      rec.stageCompletedAt = null;
      rec.createdAt = new Date();
      rec.updatedAt = new Date();
      rec.deletedAt = null;
      await cb?.(rec);
    });
  };
  return col;
}

function buildReservoirsCollection() {
  const col = makeCollection();
  const originalCreate = col.create.bind(col);
  col.create = async (cb: any) => {
    return originalCreate(async (rec: any) => {
      rec.name = 'Mock Reservoir';
      rec.volumeL = 20;
      rec.medium = 'hydro';
      rec.targetPhMin = 5.5;
      rec.targetPhMax = 6.5;
      rec.targetEcMin25c = 1.0;
      rec.targetEcMax25c = 2.0;
      rec.ppmScale = '500';
      rec.sourceWaterProfileId = null;
      rec.playbookBinding = null;
      rec.userId = null;
      rec.serverRevision = null;
      rec.serverUpdatedAtMs = null;
      rec.createdAt = new Date();
      rec.updatedAt = new Date();
      rec.deletedAt = null;
      await cb?.(rec);
    });
  };
  return col;
}

function buildPhEcReadingsCollection() {
  const col = makeCollection();
  const originalCreate = col.create.bind(col);
  col.create = async (cb: any) => {
    return originalCreate(async (rec: any) => {
      rec.reservoirId = 'mock-reservoir-id';
      rec.measuredAt = Date.now();
      rec.ph = 6.0;
      rec.ecRaw = 1.5;
      rec.ec25c = 1.5;
      rec.temperatureC = 25;
      rec.note = '';
      rec.userId = null;
      rec.serverRevision = null;
      rec.serverUpdatedAtMs = null;
      rec.createdAt = new Date();
      rec.updatedAt = new Date();
      rec.deletedAt = null;
      await cb?.(rec);
    });
  };
  return col;
}

function buildDeviationAlertsCollection() {
  const col = makeCollection();
  const originalCreate = col.create.bind(col);
  col.create = async (cb: any) => {
    const rec = await originalCreate(async (rec: any) => {
      rec.readingId = 'mock-reading-id';
      rec.type = 'pH_HIGH';
      rec.severity = 'WARNING';
      rec.message = 'Test alert';
      rec.reservoirId = 'mock-reservoir-id';
      rec.acknowledgedAt = null;
      rec.resolvedAt = null;
      rec.deliveredAtLocal = null;
      rec.userId = null;
      rec.serverRevision = null;
      rec.serverUpdatedAtMs = null;
      rec.createdAt = new Date();
      rec.updatedAt = new Date();
      rec.deletedAt = null;
      await cb?.(rec);
      return rec;
    });

    // Add model-specific methods
    rec.markDeliveredLocally = jest.fn().mockImplementation(async function (
      this: MockModel
    ) {
      await this.update(() => {
        this.deliveredAtLocal = Date.now();
      });
    });

    rec.acknowledge = jest.fn().mockImplementation(async function (
      this: MockModel
    ) {
      await this.update(() => {
        this.acknowledgedAt = Date.now();
      });
    });

    rec.resolve = jest.fn().mockImplementation(async function (
      this: MockModel
    ) {
      await this.update(() => {
        this.resolvedAt = Date.now();
      });
    });

    return rec;
  };
  return col;
}

function buildReservoirEventsCollection() {
  const col = makeCollection();
  const originalCreate = col.create.bind(col);
  col.create = async (cb: any) => {
    return originalCreate(async (rec: any) => {
      rec.reservoirId = 'mock-reservoir-id';
      rec.kind = 'CHANGE';
      rec.deltaEc25c = null;
      rec.deltaPh = null;
      rec.note = '';
      rec.userId = null;
      rec.serverRevision = null;
      rec.serverUpdatedAtMs = null;
      rec.createdAt = new Date();
      rec.updatedAt = new Date();
      rec.deletedAt = null;
      await cb?.(rec);
    });
  };
  return col;
}

// Mock Database class
class DatabaseMock {
  collections: Map<string, any> = new Map();

  constructor(_config: any) {
    this.collections.set('tasks', buildTasksCollection());
    this.collections.set('series', buildSeriesCollection());
    this.collections.set('occurrence_overrides', buildOverridesCollection());
    this.collections.set('image_upload_queue', buildUploadQueueCollection());
    this.collections.set(
      'notification_preferences',
      buildNotificationPreferencesCollection()
    );
    this.collections.set('harvests', buildHarvestsCollection());
    this.collections.set('reservoirs_v2', buildReservoirsCollection());
    this.collections.set('ph_ec_readings_v2', buildPhEcReadingsCollection());
    this.collections.set(
      'deviation_alerts_v2',
      buildDeviationAlertsCollection()
    );
    this.collections.set('reservoir_events', buildReservoirEventsCollection());
  }

  write = jest
    .fn()
    .mockImplementation(async (executor: (writer: any) => Promise<void>) => {
      return executor({});
    });

  get = jest.fn().mockImplementation((collectionName: string) => {
    return this.collections.get(collectionName);
  });
}

// Schema/migrations helpers minimal mocks (preserve input shape for tests)
export const schemaMigrations = (cfg: any) => ({
  migrations: cfg?.migrations ?? [],
});
export const addColumns = (cfg: any) => ({ type: 'addColumns', ...cfg });
export const appSchema = (cfg: any) => cfg;
export const tableSchema = (cfg: any) => cfg;

// Mock SQLiteAdapter export
export { default as SQLiteAdapter } from './adapters/sqlite';

// Mock Database export
export { DatabaseMock as Database };

// Default export
export default {
  Database: DatabaseMock,
  Q,
  SQLiteAdapter: SQLiteAdapterMock,
  Model,
  appSchema,
  tableSchema,
  schemaMigrations,
  addColumns,
};
