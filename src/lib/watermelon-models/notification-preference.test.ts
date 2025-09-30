import { jest } from '@jest/globals';

import { NotificationPreferenceModel } from '@/lib/watermelon-models/notification-preference';

// Mock the database
const mockDatabase = {
  collections: {
    get: jest.fn(),
  },
  write: jest.fn().mockImplementation(async (executor: any) => {
    return executor({});
  }),
};

jest.mock('@/lib/watermelon', () => ({
  database: mockDatabase,
}));

function setupMockCollection() {
  const mockCollection = {
    query: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    fetch: jest.fn(),
    create: jest.fn(),
  };
  mockDatabase.collections.get.mockReturnValue(mockCollection);
  (mockDatabase.write as jest.Mock).mockImplementation(async (executor: any) =>
    executor({})
  );
  return mockCollection;
}

describe('NotificationPreferenceModel', () => {
  let mockCollection: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCollection = setupMockCollection();
  });

  testFindOrCreate(mockCollection);
  testUpsert(mockCollection);
  testConcurrentOperations(mockCollection);
});

function testFindOrCreate(mockCollection: any) {
  describe('findOrCreate', () => {
    it('returns existing record', async () => {
      const existing = { id: '1', userId: 'user-123' };
      mockCollection.fetch.mockResolvedValue([existing]);

      const result = await NotificationPreferenceModel.findOrCreate(
        mockDatabase as any,
        'user-123'
      );

      expect(result).toBe(existing);
    });

    it('creates new record with defaults', async () => {
      const created = { id: '2', userId: 'user-123' };
      mockCollection.fetch.mockResolvedValue([]);
      mockCollection.create.mockResolvedValue(created);

      const result = await NotificationPreferenceModel.findOrCreate(
        mockDatabase as any,
        'user-123'
      );

      expect(result).toBe(created);
      expect(mockCollection.create).toHaveBeenCalledTimes(1);
    });

    it('creates new record with custom defaults', async () => {
      const created = { id: '3', userId: 'user-456' };
      mockCollection.fetch.mockResolvedValue([]);
      mockCollection.create.mockResolvedValue(created);

      const result = await NotificationPreferenceModel.findOrCreate(
        mockDatabase as any,
        'user-456',
        { communityInteractions: false }
      );

      expect(result).toBe(created);
    });
  });
}

function testUpsert(mockCollection: any) {
  describe('upsert', () => {
    it('is an alias for findOrCreate', async () => {
      const existing = { id: '4', userId: 'user-789' };
      mockCollection.fetch.mockResolvedValue([existing]);

      const result = await NotificationPreferenceModel.upsert(
        mockDatabase as any,
        'user-789'
      );

      expect(result).toBe(existing);
    });
  });
}

function testConcurrentOperations(mockCollection: any) {
  describe('concurrent operations', () => {
    it('handles concurrent calls', async () => {
      mockCollection.fetch.mockResolvedValueOnce([]);
      mockCollection.create.mockResolvedValue({
        id: '5',
        userId: 'concurrent',
      });
      mockCollection.fetch.mockResolvedValueOnce([]);
      mockCollection.create.mockResolvedValue({
        id: '6',
        userId: 'concurrent',
      });

      const [result1, result2] = await Promise.all([
        NotificationPreferenceModel.findOrCreate(
          mockDatabase as any,
          'concurrent'
        ),
        NotificationPreferenceModel.findOrCreate(
          mockDatabase as any,
          'concurrent'
        ),
      ]);

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });

    it('uses write transaction', async () => {
      const existing = { id: '7', userId: 'transaction' };
      mockCollection.fetch.mockResolvedValue([existing]);

      await NotificationPreferenceModel.findOrCreate(
        mockDatabase as any,
        'transaction'
      );

      expect(mockDatabase.write).toHaveBeenCalledTimes(1);
    });
  });
}
