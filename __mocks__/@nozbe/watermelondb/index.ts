// Main WatermelonDB mock for Jest
import SQLiteAdapterMock from './adapters/sqlite';

// Mock Database class
class DatabaseMock {
  collections: Map<string, any> = new Map();

  constructor(_config: any) {
    // Mock collections for tests
    this.collections.set('tasks', {
      create: jest.fn().mockResolvedValue({
        id: 'mock-task-id',
        _raw: {},
        update: jest.fn().mockResolvedValue({}),
        markAsDeleted: jest.fn().mockResolvedValue({}),
      }),
      query: jest.fn().mockReturnValue({
        fetch: jest.fn().mockResolvedValue([]),
      }),
      find: jest.fn().mockResolvedValue({
        id: 'mock-task-id',
        _raw: {},
        update: jest.fn().mockResolvedValue({}),
        markAsDeleted: jest.fn().mockResolvedValue({}),
      }),
    });

    this.collections.set('series', {
      create: jest.fn().mockResolvedValue({
        id: 'mock-series-id',
        _raw: {},
        update: jest.fn().mockResolvedValue({}),
        markAsDeleted: jest.fn().mockResolvedValue({}),
      }),
      query: jest.fn().mockReturnValue({
        fetch: jest.fn().mockResolvedValue([]),
      }),
      find: jest.fn().mockResolvedValue({
        id: 'mock-series-id',
        _raw: {},
        update: jest.fn().mockResolvedValue({}),
        markAsDeleted: jest.fn().mockResolvedValue({}),
      }),
    });

    this.collections.set('occurrence_overrides', {
      create: jest.fn().mockResolvedValue({
        id: 'mock-override-id',
        _raw: {},
        update: jest.fn().mockResolvedValue({}),
        markAsDeleted: jest.fn().mockResolvedValue({}),
      }),
      query: jest.fn().mockReturnValue({
        fetch: jest.fn().mockResolvedValue([]),
      }),
    });

    // Image upload queue collection mock
    this.collections.set('image_upload_queue', {
      create: jest.fn().mockResolvedValue({ id: 'mock-upload-id', _raw: {} }),
      query: jest.fn().mockReturnValue({
        fetch: jest.fn().mockResolvedValue([]),
      }),
      find: jest.fn().mockResolvedValue({
        id: 'mock-upload-id',
        _raw: {},
        update: jest.fn().mockResolvedValue({}),
      }),
    });
  }

  write = jest
    .fn()
    .mockImplementation(async (executor: (writer: any) => Promise<void>) => {
      const mockWriter = {
        create: jest.fn().mockResolvedValue({
          id: 'mock-id',
          _raw: {},
        }),
        update: jest.fn().mockResolvedValue({}),
        markAsDeleted: jest.fn().mockResolvedValue({}),
      };

      return executor(mockWriter);
    });

  get = jest.fn().mockImplementation((collectionName: string) => {
    return this.collections.get(collectionName);
  });
}

// Minimal Model base class so modelClasses can extend it without side effects
export class Model {}

// Mock Q (Query) builder
const Q = {
  where: jest.fn().mockReturnThis(),
  and: jest.fn().mockReturnThis(),
  or: jest.fn().mockReturnThis(),
  not: jest.fn().mockReturnThis(),
  on: jest.fn().mockReturnThis(),
  sortBy: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  unsafeSqlQuery: jest.fn().mockReturnThis(),
  unsafeSqlExpr: jest.fn().mockReturnThis(),
  oneOf: jest.fn().mockReturnThis(),
  notIn: jest.fn().mockReturnThis(),
  includes: jest.fn().mockReturnThis(),
  sanitizeLikeString: jest.fn().mockReturnValue(''),
};

// Schema/migrations helpers minimal mocks
export const schemaMigrations = (_cfg: any) => ({ migrations: [] });
export const addColumns = (_cfg: any) => ({ type: 'addColumns' });
export const appSchema = (cfg: any) => cfg;
export const tableSchema = (cfg: any) => cfg;

// Mock SQLiteAdapter export
export { default as SQLiteAdapter } from './adapters/sqlite';

// Mock Database export
export { DatabaseMock as Database };

// Mock Q export
export { Q };

// Default export
export default {
  Database: DatabaseMock,
  Q,
  SQLiteAdapter: SQLiteAdapterMock,
  Model,
};
