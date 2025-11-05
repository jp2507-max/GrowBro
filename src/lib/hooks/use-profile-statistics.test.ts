import { Q } from '@nozbe/watermelondb';

import { cleanup, renderHook, waitFor } from '@/lib/test-utils';

import { useProfileStatistics } from './use-profile-statistics';

afterEach(cleanup);

const mockPlantsCollection = {
  query: jest.fn().mockReturnThis(),
  fetchCount: jest.fn(),
  observe: jest.fn().mockReturnThis(),
  subscribe: jest.fn().mockReturnValue({
    unsubscribe: jest.fn(),
  }),
};

const mockHarvestsCollection = {
  query: jest.fn().mockReturnThis(),
  fetchCount: jest.fn(),
  observe: jest.fn().mockReturnThis(),
  subscribe: jest.fn().mockReturnValue({
    unsubscribe: jest.fn(),
  }),
};

const mockPostsCollection = {
  query: jest.fn().mockReturnThis(),
  fetchCount: jest.fn(),
  fetch: jest.fn(),
  observe: jest.fn().mockReturnThis(),
  subscribe: jest.fn().mockReturnValue({
    unsubscribe: jest.fn(),
  }),
};

const mockPostLikesCollection = {
  query: jest.fn().mockReturnThis(),
  observe: jest.fn().mockReturnThis(),
  subscribe: jest.fn().mockReturnValue({
    unsubscribe: jest.fn(),
  }),
};

const mockDatabase = {
  collections: {
    get: jest.fn(),
  },
};

jest.mock('@nozbe/watermelondb/react', () => ({
  useDatabase: jest.fn(),
}));

jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    where: jest.fn(),
  },
}));

describe('useProfileStatistics', () => {
  beforeAll(() => {
    jest.useFakeTimers();
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock the useDatabase hook
    const { useDatabase } = require('@nozbe/watermelondb/react');
    (useDatabase as jest.Mock).mockReturnValue(mockDatabase);

    mockDatabase.collections.get.mockImplementation((collectionName) => {
      switch (collectionName) {
        case 'plants':
          return mockPlantsCollection;
        case 'harvests':
          return mockHarvestsCollection;
        case 'posts':
          return mockPostsCollection;
        case 'post_likes':
          return mockPostLikesCollection;
        default:
          throw new Error(`Unknown collection: ${collectionName}`);
      }
    });

    mockPlantsCollection.fetchCount.mockResolvedValue(5);
    mockHarvestsCollection.fetchCount.mockResolvedValue(3);
    mockPostsCollection.fetchCount.mockResolvedValue(10);
    mockPostsCollection.fetch.mockResolvedValue([
      {
        likes: {
          fetchCount: jest.fn().mockResolvedValue(2),
        },
      },
      {
        likes: {
          fetchCount: jest.fn().mockResolvedValue(3),
        },
      },
    ]);

    (Q.where as jest.Mock).mockReturnValue('where_clause');
  });

  describe('Initial State', () => {
    test('initializes with loading state and zero counts', () => {
      const { result } = renderHook(() => useProfileStatistics('user-123'));

      expect(result.current.isLoading).toBe(true);
      expect(result.current.isSyncing).toBe(false);
      expect(result.current.plantsCount).toBe(0);
      expect(result.current.harvestsCount).toBe(0);
      expect(result.current.postsCount).toBe(0);
      expect(result.current.likesReceived).toBe(0);
    });
  });

  describe('Data Fetching', () => {
    test('fetches statistics with user filtering', async () => {
      const { useDatabase } = await import('@nozbe/watermelondb/react');
      (useDatabase as jest.Mock).mockReturnValue(mockDatabase);

      renderHook(() => useProfileStatistics('user-123'));

      await waitFor(() =>
        expect(mockPlantsCollection.query).toHaveBeenCalledWith('where_clause')
      );
      await waitFor(() =>
        expect(mockHarvestsCollection.query).toHaveBeenCalledWith(
          'where_clause'
        )
      );
      await waitFor(() =>
        expect(Q.where).toHaveBeenCalledWith('user_id', 'user-123')
      );
    });

    test('updates statistics when data is fetched', async () => {
      const { useDatabase } = await import('@nozbe/watermelondb/react');
      (useDatabase as jest.Mock).mockReturnValue(mockDatabase);

      const { result } = renderHook(() => useProfileStatistics('user-123'));

      await waitFor(() =>
        expect(result.current).toMatchObject({
          plantsCount: 5,
          harvestsCount: 3,
          postsCount: 10,
          likesReceived: 5,
          isLoading: false,
        })
      );
    });

    test('handles missing collections gracefully', async () => {
      const { useDatabase } = await import('@nozbe/watermelondb/react');
      (useDatabase as jest.Mock).mockReturnValue(mockDatabase);

      mockDatabase.collections.get.mockImplementation(() => {
        throw new Error('Collection not found');
      });

      const { result } = renderHook(() => useProfileStatistics('user-123'));

      await waitFor(() =>
        expect(result.current).toMatchObject({
          plantsCount: 0,
          harvestsCount: 0,
          postsCount: 0,
          likesReceived: 0,
          isLoading: false,
        })
      );
    });
  });

  describe('Throttling', () => {
    test('throttles rapid updates', async () => {
      const { useDatabase } = await import('@nozbe/watermelondb/react');
      (useDatabase as jest.Mock).mockReturnValue(mockDatabase);

      const { result } = renderHook(() => useProfileStatistics('user-123'));

      await waitFor(() => {
        expect(mockPlantsCollection.fetchCount).toHaveBeenCalledTimes(1);
      });

      // Simulate rapid refresh calls
      result.current.refresh();
      result.current.refresh();

      // Should not fetch again due to throttling
      expect(mockPlantsCollection.fetchCount).toHaveBeenCalledTimes(1);
    });
  });

  describe('Refresh Functionality', () => {
    test('refresh updates statistics', async () => {
      const { useDatabase } = await import('@nozbe/watermelondb/react');
      (useDatabase as jest.Mock).mockReturnValue(mockDatabase);

      const { result } = renderHook(() => useProfileStatistics('user-123'));

      await waitFor(() => {
        expect(mockPlantsCollection.fetchCount).toHaveBeenCalledTimes(1);
      });

      // Advance timers to allow refresh
      jest.advanceTimersByTime(300);

      result.current.refresh();

      await waitFor(() => {
        expect(mockPlantsCollection.fetchCount).toHaveBeenCalledTimes(2);
      });

      expect(result.current.isSyncing).toBe(false);
    });
  });

  describe('Real-time Updates', () => {
    test('sets up collection observers', async () => {
      const { useDatabase } = await import('@nozbe/watermelondb/react');
      (useDatabase as jest.Mock).mockReturnValue(mockDatabase);

      renderHook(() => useProfileStatistics('user-123'));

      await waitFor(() =>
        expect(mockPlantsCollection.observe).toHaveBeenCalled()
      );
      await waitFor(() =>
        expect(mockHarvestsCollection.observe).toHaveBeenCalled()
      );
      await waitFor(() =>
        expect(mockPostsCollection.observe).toHaveBeenCalled()
      );
      await waitFor(() =>
        expect(mockPostLikesCollection.observe).toHaveBeenCalled()
      );
    });
  });
});
