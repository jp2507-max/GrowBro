// @ts-nocheck
/* eslint-disable max-lines-per-function */
/**
 * Unit tests for useStrain React Query hook
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';

import type { Strain } from '@/types/strains';

import type { StrainsApiClient } from './client';
import { getStrainsApiClient } from './client';
import { useStrain } from './use-strain';

// Mock the API client
jest.mock('./client');
const mockGetStrainsApiClient = getStrainsApiClient as jest.MockedFunction<
  typeof getStrainsApiClient
>;

const mockClient: jest.Mocked<
  Pick<StrainsApiClient, 'getStrains' | 'getStrain'>
> = {
  getStrains: jest.fn(),
  getStrain: jest.fn(),
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      gcTime: 0,
    },
  },
});

const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

const mockStrain: Strain = {
  id: 'og-kush-001',
  name: 'OG Kush',
  slug: 'og-kush',
  synonyms: ['OG', 'Original Kush'],
  link: 'https://example.com/og-kush',
  imageUrl: 'https://example.com/og-kush.jpg',
  description: ['Classic indica-dominant hybrid'],
  genetics: {
    parents: ['Chemdawg', 'Hindu Kush'],
    lineage: 'Chemdawg x Hindu Kush',
  },
  race: 'hybrid',
  thc: { min: 18, max: 24 },
  cbd: { min: 0.1, max: 0.3 },
  effects: [{ name: 'Relaxed', intensity: 'high' }],
  flavors: [{ name: 'Earthy' }, { name: 'Pine' }],
  terpenes: [{ name: 'Myrcene', percentage: 0.5 }],
  grow: {
    difficulty: 'intermediate',
    indoor_suitable: true,
    outdoor_suitable: true,
    flowering_time: { min_weeks: 8, max_weeks: 9 },
    yield: { indoor: { min_grams: 400, max_grams: 600 } },
    height: { indoor_cm: 90 },
  },
  source: {
    provider: 'The Weed DB',
    updated_at: '2025-01-15T12:00:00Z',
    attribution_url: 'https://www.theweedb.com',
  },
  thc_display: '18-24%',
  cbd_display: '0.1-0.3%',
};

describe('useStrain', () => {
  beforeEach(() => {
    queryClient.clear();
    jest.clearAllMocks();
    mockGetStrainsApiClient.mockReturnValue(
      mockClient as unknown as StrainsApiClient
    );
  });

  describe('successful fetch', () => {
    test('fetches strain by ID', async () => {
      mockClient.getStrain.mockResolvedValueOnce(mockStrain);

      const { result } = renderHook(useStrain, {
        initialProps: { strainId: 'og-kush-001' },
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockClient.getStrain).toHaveBeenCalledWith(
        'og-kush-001',
        expect.any(AbortSignal)
      );

      expect(result.current.data).toEqual(mockStrain);
    });

    test('returns all strain fields', async () => {
      mockClient.getStrain.mockResolvedValueOnce(mockStrain);

      const { result } = renderHook(useStrain, {
        initialProps: { strainId: 'og-kush-001' },
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const strain = result.current.data!;
      expect(strain.id).toBe('og-kush-001');
      expect(strain.name).toBe('OG Kush');
      expect(strain.race).toBe('hybrid');
      expect(strain.thc_display).toBe('18-24%');
      expect(strain.cbd_display).toBe('0.1-0.3%');
      expect(strain.effects).toHaveLength(1);
      expect(strain.flavors).toHaveLength(2);
      expect(strain.terpenes).toHaveLength(1);
    });
  });

  describe('loading states', () => {
    test('shows loading state initially', () => {
      mockClient.getStrain.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const { result } = renderHook(useStrain, {
        initialProps: { strainId: 'og-kush-001' },
        wrapper,
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();
    });

    test('transitions to success state', async () => {
      mockClient.getStrain.mockResolvedValueOnce(mockStrain);

      const { result } = renderHook(useStrain, {
        initialProps: { strainId: 'og-kush-001' },
        wrapper,
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('error handling', () => {
    test('handles fetch errors', async () => {
      const error = new Error('Strain not found') as any;
      error.response = { status: 404 };
      mockClient.getStrain.mockRejectedValueOnce(error);

      const { result } = renderHook(useStrain, {
        initialProps: { strainId: 'non-existent' },
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toEqual(error);
      expect(result.current.data).toBeUndefined();
    });

    test('retries once on failure', async () => {
      const error = new Error('Network error') as any;
      error.response = { status: 500 };
      mockClient.getStrain
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(mockStrain);

      const retryQueryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            retryDelay: 0,
            gcTime: 0,
          },
        },
      });

      const retryWrapper: React.FC<{ children: React.ReactNode }> = ({
        children,
      }) => (
        <QueryClientProvider client={retryQueryClient}>
          {children}
        </QueryClientProvider>
      );

      const { result } = renderHook(useStrain, {
        initialProps: { strainId: 'og-kush-001' },
        wrapper: retryWrapper,
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockClient.getStrain).toHaveBeenCalledTimes(2);
      expect(result.current.data).toEqual(mockStrain);
    });
  });

  describe('caching behavior', () => {
    test('uses 24-hour staleTime', async () => {
      mockClient.getStrain.mockResolvedValueOnce(mockStrain);

      const { result } = renderHook(useStrain, {
        initialProps: { strainId: 'og-kush-001' },
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Query should be fresh for 24 hours
      expect(result.current.isStale).toBe(false);
    });

    test('caches strain data by ID', async () => {
      mockClient.getStrain.mockResolvedValueOnce(mockStrain);

      const { result: result1 } = renderHook(useStrain, {
        initialProps: { strainId: 'og-kush-001' },
        wrapper,
      });

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
      });

      // Second hook with same ID should use cache
      const { result: result2 } = renderHook(useStrain, {
        initialProps: { strainId: 'og-kush-001' },
        wrapper,
      });

      // Should immediately have data from cache
      expect(result2.current.data).toEqual(mockStrain);
      expect(mockClient.getStrain).toHaveBeenCalledTimes(1);
    });
  });

  describe('AbortSignal integration', () => {
    test('passes AbortSignal to API client', async () => {
      mockClient.getStrain.mockResolvedValueOnce(mockStrain);

      const { result } = renderHook(useStrain, {
        initialProps: { strainId: 'og-kush-001' },
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockClient.getStrain).toHaveBeenCalledWith(
        'og-kush-001',
        expect.any(AbortSignal)
      );
    });
  });

  describe('query key stability', () => {
    test('uses consistent query key for same strain ID', async () => {
      mockClient.getStrain.mockResolvedValue(mockStrain);

      const { result: result1 } = renderHook(useStrain, {
        initialProps: { strainId: 'og-kush-001' },
        wrapper,
      });

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
      });

      const { result: result2 } = renderHook(useStrain, {
        initialProps: { strainId: 'og-kush-001' },
        wrapper,
      });

      // Both should use the same cached data
      expect(result2.current.data).toBe(result1.current.data);
    });
  });
});
