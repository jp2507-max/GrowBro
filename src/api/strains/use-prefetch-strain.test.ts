/* eslint-disable max-lines-per-function */
import { useQueryClient } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';

import { getStrainsApiClient } from './client';
import {
  usePrefetchStrain,
  usePrefetchStrainsPage,
} from './use-prefetch-strain';

// Mock the API client
jest.mock('./client');
const mockGetStrainsApiClient = getStrainsApiClient as jest.MockedFunction<
  typeof getStrainsApiClient
>;

// Mock React Query
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: jest.fn(),
}));

const mockQueryClient = {
  prefetchQuery: jest.fn(),
  prefetchInfiniteQuery: jest.fn(),
};

const mockClient = {
  getStrain: jest.fn(),
  getStrains: jest.fn(),
};

describe('usePrefetchStrain', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetStrainsApiClient.mockReturnValue(mockClient as any);
    (useQueryClient as jest.Mock).mockReturnValue(mockQueryClient);
  });

  describe('usePrefetchStrain', () => {
    test('prefetches strain with correct parameters', async () => {
      const { result } = renderHook(() => usePrefetchStrain());

      await act(async () => {
        await result.current('test-strain-id');
      });

      expect(mockQueryClient.prefetchQuery).toHaveBeenCalledWith({
        queryKey: ['strain', { strainId: 'test-strain-id' }],
        queryFn: expect.any(Function),
        staleTime: 24 * 60 * 60 * 1000, // 24 hours
        gcTime: 2 * 24 * 60 * 60 * 1000, // 48 hours
      });

      // Verify the queryFn calls the client correctly
      const queryFn = mockQueryClient.prefetchQuery.mock.calls[0][0].queryFn;
      const mockSignal = {};
      await queryFn({ signal: mockSignal });

      expect(mockClient.getStrain).toHaveBeenCalledWith(
        'test-strain-id',
        mockSignal
      );
    });
  });

  describe('usePrefetchStrainsPage', () => {
    test('prefetches strains page with default params', async () => {
      const { result } = renderHook(() => usePrefetchStrainsPage());

      await act(async () => {
        await result.current({});
      });

      expect(mockQueryClient.prefetchInfiniteQuery).toHaveBeenCalledWith({
        queryKey: ['strains'],
        queryFn: expect.any(Function),
        initialPageParam: undefined,
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000, // 10 minutes
      });

      // Verify the queryFn calls the client correctly
      const queryFn =
        mockQueryClient.prefetchInfiniteQuery.mock.calls[0][0].queryFn;
      const mockSignal = {};
      await queryFn({ pageParam: undefined, signal: mockSignal });

      expect(mockClient.getStrains).toHaveBeenCalledWith({
        cursor: undefined,
        signal: mockSignal,
      });
    });

    test('prefetches strains page with filters', async () => {
      const { result } = renderHook(() => usePrefetchStrainsPage());

      const params = {
        cursor: 'test-cursor',
        searchQuery: 'OG Kush',
        filters: {
          race: 'indica' as const,
          effects: ['Relaxed', 'Happy'],
          thcMin: 15,
          thcMax: 25,
        },
        pageSize: 10,
      };

      await act(async () => {
        await result.current(params);
      });

      expect(mockQueryClient.prefetchInfiniteQuery).toHaveBeenCalledWith({
        queryKey: ['strains'],
        queryFn: expect.any(Function),
        initialPageParam: undefined,
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
      });

      // Verify the queryFn calls the client correctly
      const queryFn =
        mockQueryClient.prefetchInfiniteQuery.mock.calls[0][0].queryFn;
      const mockSignal = {};
      await queryFn({ pageParam: undefined, signal: mockSignal });

      expect(mockClient.getStrains).toHaveBeenCalledWith({
        ...params,
        signal: mockSignal,
      });
    });

    test('uses stable query key for cache consistency', async () => {
      const { result } = renderHook(() => usePrefetchStrainsPage());

      const params1 = { cursor: 'cursor1', searchQuery: 'test' };
      const params2 = { cursor: 'cursor1', searchQuery: 'test' };

      await act(async () => {
        await result.current(params1);
        await result.current(params2);
      });

      // Both calls should use the same query key
      expect(mockQueryClient.prefetchInfiniteQuery).toHaveBeenCalledTimes(2);
      expect(
        mockQueryClient.prefetchInfiniteQuery.mock.calls[0][0].queryKey
      ).toEqual(
        mockQueryClient.prefetchInfiniteQuery.mock.calls[1][0].queryKey
      );
    });
  });
});
