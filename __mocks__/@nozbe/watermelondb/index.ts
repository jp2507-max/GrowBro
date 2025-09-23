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

type WhereCond = { key: string; value: any };

// Minimal Model base class so modelClasses can extend it without side effects
export class Model {}

// Mock Q (Query) builder with only what we use
export const Q = {
  where(key: string, value: any): WhereCond {
    return { key, value };
  },
};

// Generic collection factory
function makeCollection(initial: any[] = []) {
  const store: any[] = [...initial];

  function findIndexById(id: string): number {
    return store.findIndex((r) => r.id === id);
  }

  return {
    async create(cb: (rec: any) => void | Promise<void>) {
      const rec: any = {
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
      if (cb) await cb(rec);
      // Ensure Date-like fields are Dates where expected
      rec.createdAt = rec.createdAt ?? new Date();
      rec.updatedAt = rec.updatedAt ?? new Date();
      store.push(rec);
      return rec;
    },
    query: (...conds: WhereCond[]) => {
      const filters = conds ?? [];
      const chain = {
        where: (_k: string, _v: any) => chain, // allow chaining though ignored
        async fetch() {
          return store.filter((row) =>
            filters.every((c) => {
              const key = mapFieldName(c.key);
              return (row as any)[key] === c.value;
            })
          );
        },
      } as const;
      return chain;
    },
    async find(id: string) {
      const idx = findIndexById(id);
      if (idx === -1) {
        // create a placeholder if missing to avoid crashes
        const rec = {
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
        store.push(rec);
        return rec as any;
      }
      return store[idx];
    },
    // Expose for debugging in tests if needed
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
