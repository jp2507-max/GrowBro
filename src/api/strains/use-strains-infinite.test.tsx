// @ts-nocheck

/**
 * Unit tests for useStrainsInfinite React Query hook
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';

import { getStrainsApiClient } from './client';
import { fetchStrainsFromSupabase } from './supabase-list';
import type { StrainsResponse } from './types';
import { useStrainsInfinite } from './use-strains-infinite';
import { useOfflineAwareStrains } from './use-strains-infinite-with-cache';

// Mock the API client
jest.mock('./client');
jest.mock('./supabase-list', () => ({
  fetchStrainsFromSupabase: jest.fn(),
  mapSupabaseRowToStrain: jest.fn(),
}));
jest.mock('@/lib/watermelon-models/cached-strains-repository', () => ({
  CachedStrainsRepository: jest.fn().mockImplementation(() => ({
    cachePage: jest.fn().mockResolvedValue(undefined),
    getCacheStats: jest.fn(),
    getCachedStrains: jest.fn(),
    clearExpiredCache: jest.fn(),
    clearAllCache: jest.fn(),
    findStrainByIdOrSlug: jest.fn(),
  })),
}));
jest.mock('@/lib/watermelon', () => ({
  database: {},
}));
jest.mock('@/lib/hooks/use-network-status', () => ({
  useNetworkStatus: () => ({ isInternetReachable: true }),
}));
const mockGetStrainsApiClient = getStrainsApiClient as jest.MockedFunction<
  typeof getStrainsApiClient
>;
const mockFetchStrainsFromSupabase =
  fetchStrainsFromSupabase as jest.MockedFunction<
    typeof fetchStrainsFromSupabase
  >;

const mockClient = {
  getStrains: jest.fn(),
  getStrain: jest.fn(),
} as any;

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
};

const mockStrainsResponse: StrainsResponse = {
  data: [
    {
      id: 'strain-1',
      name: 'OG Kush',
      slug: 'og-kush',
      synonyms: [],
      link: '',
      imageUrl: 'https://example.com/og-kush.jpg',
      description: ['Classic indica-dominant hybrid'],
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
    },
  ],
  hasMore: true,
  nextCursor: 'cursor-page-2',
};

describe('useStrainsInfinite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetStrainsApiClient.mockReturnValue(mockClient as any);
    mockFetchStrainsFromSupabase.mockReset();
    mockClient.getStrains.mockReset();
  });

  describe('initial fetch', () => {
    test('fetches strains with default params', async () => {
      mockClient.getStrains.mockResolvedValueOnce(mockStrainsResponse);

      const { result } = renderHook(
        () => useStrainsInfinite({ variables: {} }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockClient.getStrains).toHaveBeenCalledWith({
        searchQuery: undefined,
        filters: undefined,
        pageSize: 20,
        cursor: undefined,
        signal: expect.any(AbortSignal),
      });

      expect(result.current.data?.pages).toHaveLength(1);
      expect(result.current.data?.pages[0].data).toHaveLength(1);
    });

    test('applies search query', async () => {
      mockClient.getStrains.mockResolvedValueOnce(mockStrainsResponse);

      const { result } = renderHook(
        () => useStrainsInfinite({ variables: { searchQuery: 'og kush' } }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockClient.getStrains).toHaveBeenCalledWith(
        expect.objectContaining({
          searchQuery: 'og kush',
        })
      );
    });

    test('applies filters', async () => {
      mockClient.getStrains.mockResolvedValueOnce(mockStrainsResponse);

      const filters = {
        race: 'indica' as const,
        effects: ['Relaxed', 'Happy'],
        thcMin: 15,
        thcMax: 25,
      };

      const { result } = renderHook(
        () => useStrainsInfinite({ variables: { filters } }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockClient.getStrains).toHaveBeenCalledWith(
        expect.objectContaining({
          filters,
        })
      );
    });

    test('applies custom page size', async () => {
      mockClient.getStrains.mockResolvedValueOnce(mockStrainsResponse);

      const { result } = renderHook(
        () => useStrainsInfinite({ variables: { pageSize: 50 } }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockClient.getStrains).toHaveBeenCalledWith(
        expect.objectContaining({
          pageSize: 50,
        })
      );
    });
  });

  describe('pagination', () => {
    test('fetches next page with cursor', async () => {
      const page1Response: StrainsResponse = {
        ...mockStrainsResponse,
        hasMore: true,
        nextCursor: 'cursor-page-2',
      };

      const page2Response: StrainsResponse = {
        data: [
          {
            ...mockStrainsResponse.data[0],
            id: 'strain-2',
            name: 'Blue Dream',
          },
        ],
        hasMore: false,
        nextCursor: undefined,
      };

      mockClient.getStrains
        .mockResolvedValueOnce(page1Response)
        .mockResolvedValueOnce(page2Response);

      const { result } = renderHook(
        () => useStrainsInfinite({ variables: {} }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.hasNextPage).toBe(true);

      await act(async () => {
        await result.current.fetchNextPage();
      });

      await waitFor(() => {
        expect(result.current.data?.pages).toHaveLength(2);
      });

      expect(mockClient.getStrains).toHaveBeenCalledTimes(2);
      expect(mockClient.getStrains).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          cursor: 'cursor-page-2',
        })
      );

      expect(result.current.hasNextPage).toBe(false);
    });

    test('stops pagination when hasMore is false', async () => {
      const response: StrainsResponse = {
        ...mockStrainsResponse,
        hasMore: false,
        nextCursor: undefined,
      };

      mockClient.getStrains.mockResolvedValueOnce(response);

      const { result } = renderHook(
        () => useStrainsInfinite({ variables: {} }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.hasNextPage).toBe(false);
    });
  });

  describe('loading states', () => {
    test('shows loading state initially', () => {
      mockClient.getStrains.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const { result } = renderHook(
        () => useStrainsInfinite({ variables: {} }),
        {
          wrapper: createWrapper(),
        }
      );

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();
    });
  });

  describe('error handling', () => {
    test('handles fetch errors', async () => {
      const error = new Error('Network error');
      mockClient.getStrains.mockRejectedValueOnce(error);

      const { result } = renderHook(
        () => useStrainsInfinite({ variables: {} }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toEqual(error);
    });
  });

  describe('caching behavior', () => {
    test('uses staleTime of 5 minutes', async () => {
      mockClient.getStrains.mockResolvedValueOnce(mockStrainsResponse);

      const { result } = renderHook(
        () => useStrainsInfinite({ variables: {} }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Query should be fresh for 5 minutes
      expect(result.current.isStale).toBe(false);
    });

    test('keeps previous data during refetch', async () => {
      mockClient.getStrains.mockResolvedValueOnce(mockStrainsResponse);

      const { result, rerender } = renderHook(
        ({ searchQuery }) => useStrainsInfinite({ variables: { searchQuery } }),
        {
          wrapper: createWrapper(),
          initialProps: { searchQuery: 'og kush' },
        }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const firstData = result.current.data;

      // Change search query
      mockClient.getStrains.mockResolvedValueOnce({
        ...mockStrainsResponse,
        data: [{ ...mockStrainsResponse.data[0], name: 'Blue Dream' }],
      });

      rerender({ searchQuery: 'blue dream' });

      // Should keep previous data while fetching
      expect(result.current.data).toBe(firstData);

      await waitFor(() => {
        expect(result.current.data?.pages[0].data[0].name).toBe('Blue Dream');
      });
    });
  });

  describe('useOfflineAwareStrains (Supabase-first)', () => {
    test('fetches from Supabase before calling API', async () => {
      mockFetchStrainsFromSupabase.mockResolvedValueOnce(mockStrainsResponse);

      const { result } = renderHook(
        () =>
          useOfflineAwareStrains({
            searchQuery: '',
            filters: {},
            pageSize: 20,
          }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockFetchStrainsFromSupabase).toHaveBeenCalledTimes(1);
      expect(mockClient.getStrains).not.toHaveBeenCalled();
      expect(result.current.data?.pages[0].data[0].id).toBe('strain-1');
    });

    test('falls back to API when Supabase fails', async () => {
      mockFetchStrainsFromSupabase.mockRejectedValueOnce(
        new Error('supabase failure')
      );
      mockClient.getStrains.mockResolvedValueOnce(mockStrainsResponse);

      const { result } = renderHook(
        () =>
          useOfflineAwareStrains({
            searchQuery: '',
            filters: {},
            pageSize: 20,
          }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockFetchStrainsFromSupabase).toHaveBeenCalledTimes(1);
      expect(mockClient.getStrains).toHaveBeenCalledTimes(1);
      expect(result.current.data?.pages[0].data[0].id).toBe('strain-1');
    });
  });

  describe('AbortSignal integration', () => {
    test('passes AbortSignal to API client', async () => {
      mockClient.getStrains.mockResolvedValueOnce(mockStrainsResponse);

      const { result } = renderHook(
        () => useStrainsInfinite({ variables: {} }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockClient.getStrains).toHaveBeenCalledWith(
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        })
      );
    });
  });
});
