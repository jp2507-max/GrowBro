// @ts-nocheck

/**
 * Integration tests for Strains feature
 * Tests complete feature integration with existing app
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';

import { useStrain } from '@/api/strains/use-strain';
import { useStrainsInfinite } from '@/api/strains/use-strains-infinite';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { useFavorites } from '@/lib/strains/use-favorites';
import type { Strain } from '@/types/strains';

// Mock environment
jest.mock('@env', () => ({
  Env: {
    SUPABASE_URL: 'https://test.supabase.co',
    STRAINS_USE_PROXY: 'false',
    STRAINS_API_URL: 'https://api.test.com',
    STRAINS_API_KEY: 'test-key',
    STRAINS_API_HOST: 'test-host',
    FEATURE_STRAINS_ENABLED: true,
    FEATURE_STRAINS_FAVORITES_SYNC: true,
    FEATURE_STRAINS_OFFLINE_CACHE: true,
  },
}));

// Mock fetch
global.fetch = jest.fn();

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
};

describe('Strains Feature Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  describe('Feature Flags', () => {
    it('should respect feature flags', () => {
      expect(isFeatureEnabled('strainsEnabled')).toBe(true);
      expect(isFeatureEnabled('strainsFavoritesSync')).toBe(true);
      expect(isFeatureEnabled('strainsOfflineCache')).toBe(true);
    });
  });

  describe('Data Fetching Integration', () => {
    it('should fetch strains list successfully', async () => {
      const mockStrains = [
        {
          id: '1',
          name: 'OG Kush',
          race: 'hybrid',
          thc: { min: 18, max: 24 },
        },
        {
          id: '2',
          name: 'Blue Dream',
          race: 'hybrid',
          thc: { min: 17, max: 24 },
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ strains: mockStrains, hasMore: false }),
        headers: new Headers(),
      });

      const { result } = renderHook(() => useStrainsInfinite({}), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.pages[0].data).toHaveLength(2);
      expect(result.current.data?.pages[0].data[0].name).toBe('OG Kush');
    });

    it('should fetch single strain detail successfully', async () => {
      const mockStrain = {
        id: '1',
        name: 'OG Kush',
        race: 'hybrid',
        thc: { min: 18, max: 24 },
        description: ['A classic strain'],
        effects: [{ name: 'relaxed' }],
        flavors: [{ name: 'earthy' }],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ strain: mockStrain }),
        headers: new Headers(),
      });

      const { result } = renderHook(() => useStrain({ strainId: '1' }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.name).toBe('OG Kush');
      expect(result.current.data?.race).toBe('hybrid');
    });

    it('should handle API errors gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Network error')
      );

      const { result } = renderHook(() => useStrainsInfinite({}), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });
  });

  describe('Search and Filter Integration', () => {
    it('should apply search query correctly', async () => {
      const mockStrains = [{ id: '1', name: 'OG Kush', race: 'hybrid' }];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ strains: mockStrains, hasMore: false }),
        headers: new Headers(),
      });

      const { result } = renderHook(
        () => useStrainsInfinite({ variables: { searchQuery: 'og kush' } }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('search=og%20kush'),
        expect.any(Object)
      );
    });

    it('should apply filters correctly', async () => {
      const mockStrains = [{ id: '1', name: 'Indica Strain', race: 'indica' }];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ strains: mockStrains, hasMore: false }),
        headers: new Headers(),
      });

      const { result } = renderHook(
        () =>
          useStrainsInfinite({
            variables: {
              filters: {
                race: 'indica',
                difficulty: 'beginner',
              },
            },
          }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('type=indica'),
        expect.any(Object)
      );
    });
  });

  describe('Infinite Scroll Integration', () => {
    it('should load next page on fetchNextPage', async () => {
      const mockPage1 = {
        strains: [{ id: '1', name: 'Strain 1' }],
        hasMore: true,
        nextCursor: 'cursor-2',
      };

      const mockPage2 = {
        strains: [{ id: '2', name: 'Strain 2' }],
        hasMore: false,
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockPage1,
          headers: new Headers(),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockPage2,
          headers: new Headers(),
        });

      const { result } = renderHook(() => useStrainsInfinite({}), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.pages).toHaveLength(1);

      // Fetch next page
      result.current.fetchNextPage();

      await waitFor(() => {
        expect(result.current.data?.pages).toHaveLength(2);
      });

      expect(result.current.data?.pages[1].data[0].name).toBe('Strain 2');
    });
  });

  describe('Favorites Integration', () => {
    it('should add and remove favorites', async () => {
      const mockStrain: Strain = {
        id: '1',
        name: 'OG Kush',
        slug: 'og-kush',
        synonyms: [],
        link: '',
        imageUrl: 'https://example.com/image.jpg',
        description: [],
        genetics: { parents: [], lineage: '' },
        race: 'hybrid' as const,
        thc: { min: 18, max: 24 },
        cbd: { min: 0, max: 1 },
        effects: [],
        flavors: [],
        grow: {
          difficulty: 'beginner',
          indoor_suitable: true,
          outdoor_suitable: true,
          flowering_time: {},
          yield: {},
          height: {},
        },
        source: {
          provider: 'Test',
          updated_at: new Date().toISOString(),
          attribution_url: '',
        },
        thc_display: '18-24%',
        cbd_display: '0-1%',
      };

      const { result } = renderHook(() => useFavorites());

      // Add favorite
      await result.current.addFavorite(mockStrain);

      expect(result.current.isFavorite('1')).toBe(true);
      expect(result.current.getFavorites()).toHaveLength(1);

      // Remove favorite
      await result.current.removeFavorite('1');

      expect(result.current.isFavorite('1')).toBe(false);
      expect(result.current.getFavorites()).toHaveLength(0);
    });
  });

  describe('Performance Integration', () => {
    it('should cache responses appropriately', async () => {
      const mockStrains = [{ id: '1', name: 'OG Kush' }];

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ strains: mockStrains, hasMore: false }),
        headers: new Headers(),
      });

      const { result: result1 } = renderHook(() => useStrainsInfinite({}), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
      });

      // Second render should use cache
      const { result: result2 } = renderHook(() => useStrainsInfinite({}), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result2.current.isSuccess).toBe(true);
      });

      // Should only fetch once due to caching
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Recovery Integration', () => {
    it('should retry failed requests', async () => {
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ strains: [], hasMore: false }),
          headers: new Headers(),
        });

      const { result } = renderHook(() => useStrainsInfinite({}), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // Retry
      result.current.refetch();

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });
  });
});
