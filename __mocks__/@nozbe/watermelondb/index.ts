// Main WatermelonDB mock for Jest with simple in-memory persistence
import SQLiteAdapterMock from './adapters/sqlite';

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

type WhereCond = { key: string; value: any } | { key: string; $oneOf: any[] };

// Minimal Model base class so modelClasses can extend it without side effects
export class Model {}

// Mock Q (Query) builder with only what we use
export const Q = {
  where(key: string, value: any): WhereCond {
    if (typeof value === 'object' && value && '$oneOf' in value) {
      return { key, $oneOf: value.$oneOf };
    }
    return { key, value };
  },
  oneOf(values: any[]): { $oneOf: any[] } {
    return { $oneOf: values };
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
  return {
    id: makeId('id'),
    _raw: {},
    update: async (fn: (rec2: any) => void) => {
      await fn(rec);
      return rec;
    },
    markAsDeleted: async () => {
      rec.deletedAt = new Date();
      return rec;
    },
  };
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
  return {
    id,
    _raw: {},
    update: async (fn: (rec2: any) => void) => {
      await fn(rec as any);
      return rec;
    },
    markAsDeleted: async () => {
      (rec as any).deletedAt = new Date();
      return rec;
    },
  } as any;
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
    query: (
      ...conds: (
        | WhereCond
        | { $sortBy: { key: string; direction: 'asc' | 'desc' } }
        | { $take: number }
      )[]
    ) => {
      const filters = conds.filter((c) => 'key' in c) ?? [];
      const sortBy = conds.find((c) => '$sortBy' in c)?.$sortBy;
      const take = conds.find((c) => '$take' in c)?.$take;

      const chain = {
        where: (_k: string, _v: any) => chain,
        async fetch() {
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
    },
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

// Mock Database class
class DatabaseMock {
  collections: Map<string, any> = new Map();

  constructor(_config: any) {
    this.collections.set('tasks', buildTasksCollection());
    this.collections.set('series', buildSeriesCollection());
    this.collections.set('occurrence_overrides', buildOverridesCollection());
    this.collections.set('image_upload_queue', buildUploadQueueCollection());
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
