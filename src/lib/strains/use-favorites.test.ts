/**
 * Unit tests for useFavorites Zustand store
 */

import { act, renderHook, waitFor } from '@testing-library/react-native';

import type { Strain } from '@/types/strains';

import { useFavorites } from './use-favorites';

// Mock dependencies
jest.mock('@/lib/auth', () => ({
  getOptionalAuthenticatedUserId: jest.fn(() =>
    Promise.resolve('test-user-id')
  ),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      upsert: jest.fn(() => Promise.resolve({ error: null })),
    })),
  },
}));

jest.mock('@/lib/watermelon', () => ({
  database: {},
}));

jest.mock('@/lib/watermelon-models/favorites-repository', () => ({
  createFavoritesRepository: jest.fn(() => ({
    getAllAsFavoriteStrains: jest.fn(() => Promise.resolve([])),
    addFavorite: jest.fn(() => Promise.resolve()),
    removeFavorite: jest.fn(() => Promise.resolve()),
    getFavoritesNeedingSync: jest.fn(() => Promise.resolve([])),
    markAsSynced: jest.fn(() => Promise.resolve()),
  })),
}));

jest.mock('@/lib/storage', () => ({
  storage: {
    set: jest.fn(),
    get: jest.fn(),
    delete: jest.fn(),
  },
}));

// Mock analytics
jest.mock('@/lib/analytics-registry', () => ({
  getAnalyticsClient: jest.fn(() => ({
    track: jest.fn(),
  })),
}));

jest.mock('./strains-analytics', () => ({
  trackStrainFavoriteAdded: jest.fn(),
  trackStrainFavoriteRemoved: jest.fn(),
}));

const mockStrain: Strain = {
  id: 'test-strain-1',
  name: 'Test Strain',
  slug: 'test-strain',
  synonyms: [],
  link: '',
  imageUrl: 'https://example.com/image.jpg',
  description: ['Test description'],
  genetics: { parents: [], lineage: '' },
  race: 'hybrid',
  thc: { min: 18, max: 24 },
  cbd: { min: 0.1, max: 0.3 },
  effects: [],
  flavors: [],
  grow: {
    difficulty: 'intermediate',
    indoor_suitable: true,
    outdoor_suitable: true,
    flowering_time: {},
    yield: {},
    height: {},
  },
  source: {
    provider: 'The Weed DB',
    updated_at: new Date().toISOString(),
    attribution_url: '',
  },
  thc_display: '18-24%',
  cbd_display: '0.1-0.3%',
};

describe('useFavorites', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initial state', () => {
    test('starts with empty favorites', () => {
      const { result } = renderHook(() => useFavorites());
      expect(result.current.getFavorites()).toEqual([]);
    });

    test('isFavorite returns false for non-existent strain', () => {
      const { result } = renderHook(() => useFavorites());
      expect(result.current.isFavorite('non-existent')).toBe(false);
    });
  });

  describe('addFavorite', () => {
    test('adds strain to favorites', async () => {
      const { result } = renderHook(() => useFavorites());

      await act(async () => {
        await result.current.addFavorite(mockStrain);
      });

      await waitFor(() => {
        expect(result.current.isFavorite(mockStrain.id)).toBe(true);
      });
    });

    test('getFavorites returns added strain', async () => {
      const { result } = renderHook(() => useFavorites());

      await act(async () => {
        await result.current.addFavorite(mockStrain);
      });

      await waitFor(() => {
        expect(result.current.getFavorites()).toHaveLength(1);
      });

      const favorites = result.current.getFavorites();
      expect(favorites[0].id).toBe(mockStrain.id);
      expect(favorites[0].snapshot.name).toBe(mockStrain.name);
    });

    test('stores snapshot with essential fields', async () => {
      const { result } = renderHook(() => useFavorites());

      await act(async () => {
        await result.current.addFavorite(mockStrain);
      });

      await waitFor(() => {
        const favorites = result.current.getFavorites();
        const snapshot = favorites[0].snapshot;
        expect(snapshot).toEqual({
          id: mockStrain.id,
          name: mockStrain.name,
          race: mockStrain.race,
          thc_display: mockStrain.thc_display,
          imageUrl: mockStrain.imageUrl,
        });
      });
    });
  });

  describe('removeFavorite', () => {
    test('removes strain from favorites', async () => {
      const { result } = renderHook(() => useFavorites());

      await act(async () => {
        await result.current.addFavorite(mockStrain);
      });

      await waitFor(() => {
        expect(result.current.isFavorite(mockStrain.id)).toBe(true);
      });

      await act(async () => {
        await result.current.removeFavorite(mockStrain.id);
      });

      await waitFor(() => {
        expect(result.current.isFavorite(mockStrain.id)).toBe(false);
      });
    });

    test('getFavorites returns empty after removal', async () => {
      const { result } = renderHook(() => useFavorites());

      await act(async () => {
        await result.current.addFavorite(mockStrain);
        await result.current.removeFavorite(mockStrain.id);
      });

      await waitFor(() => {
        expect(result.current.getFavorites()).toEqual([]);
      });
    });

    test('handles removing non-existent favorite gracefully', async () => {
      const { result } = renderHook(() => useFavorites());

      await act(async () => {
        await result.current.removeFavorite('non-existent');
      });

      // Should not throw error
      expect(result.current.getFavorites()).toEqual([]);
    });
  });

  describe('multiple favorites', () => {
    test('manages multiple favorites correctly', async () => {
      const { result } = renderHook(() => useFavorites());

      const strain2: Strain = {
        ...mockStrain,
        id: 'test-strain-2',
        name: 'Strain 2',
      };
      const strain3: Strain = {
        ...mockStrain,
        id: 'test-strain-3',
        name: 'Strain 3',
      };

      await act(async () => {
        await result.current.addFavorite(mockStrain);
        await result.current.addFavorite(strain2);
        await result.current.addFavorite(strain3);
      });

      await waitFor(() => {
        expect(result.current.getFavorites()).toHaveLength(3);
      });

      expect(result.current.isFavorite(mockStrain.id)).toBe(true);
      expect(result.current.isFavorite(strain2.id)).toBe(true);
      expect(result.current.isFavorite(strain3.id)).toBe(true);
    });

    test('sorts favorites by addedAt descending', async () => {
      const { result } = renderHook(() => useFavorites());

      const strain2: Strain = {
        ...mockStrain,
        id: 'test-strain-2',
        name: 'Strain 2',
      };

      await act(async () => {
        await result.current.addFavorite(mockStrain);
        // Small delay to ensure different timestamps
        await new Promise((resolve) => setTimeout(resolve, 10));
        await result.current.addFavorite(strain2);
      });

      await waitFor(() => {
        expect(result.current.getFavorites()).toHaveLength(2);
      });

      const favorites = result.current.getFavorites();
      expect(favorites[0].id).toBe(strain2.id); // Most recent first
      expect(favorites[1].id).toBe(mockStrain.id);
    });
  });

  describe('sync state', () => {
    test('tracks syncing state', () => {
      const { result } = renderHook(() => useFavorites());
      expect(result.current.isSyncing).toBe(false);
    });

    test('tracks sync errors', () => {
      const { result } = renderHook(() => useFavorites());
      expect(result.current.syncError).toBeNull();
    });

    test('tracks last sync timestamp', () => {
      const { result } = renderHook(() => useFavorites());
      expect(result.current.lastSyncAt).toBeNull();
    });
  });
});
