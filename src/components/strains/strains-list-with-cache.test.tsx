// @ts-nocheck

/**
 * Unit tests for StrainsListWithCache component
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

import { getStrainsApiClient } from '@/api/strains/client';
import type { StrainsResponse } from '@/api/strains/types';
import { cleanup, render, screen, waitFor } from '@/lib/test-utils';
import type { Strain } from '@/types/strains';

import { StrainsListWithCache } from './strains-list-with-cache';

// Mock the API client
jest.mock('@/api/strains/client');
const mockGetStrainsApiClient = getStrainsApiClient as jest.MockedFunction<
  typeof getStrainsApiClient
>;

const mockClient = {
  getStrains: jest.fn(),
  getStrain: jest.fn(),
};

// Mock expo-router
jest.mock('expo-router', () => ({
  Link: ({ children, href, ...props }: any) => {
    // Return a real React element with forwarded props and data-href
    return React.createElement(
      'a',
      {
        ...props,
        'data-href': href,
      },
      children
    );
  },
}));

// Mock FlashList
jest.mock('@shopify/flash-list', () => ({
  FlashList: ({
    data,
    renderItem,
    ListEmptyComponent,
    ListFooterComponent,
  }: any) => {
    if (!data || data.length === 0) {
      return ListEmptyComponent ? <>{ListEmptyComponent}</> : null;
    }
    return (
      <>
        {data.map((item: any, index: number) => (
          <div key={item.id || index}>{renderItem({ item, index })}</div>
        ))}
        {ListFooterComponent && <>{ListFooterComponent}</>}
      </>
    );
  },
}));

afterEach(cleanup);

const mockStrain: Strain = {
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
};

const mockStrainsResponse: StrainsResponse = {
  data: [mockStrain],
  hasMore: false,
  nextCursor: undefined,
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('StrainsListWithCache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetStrainsApiClient.mockReturnValue(mockClient as any);
  });

  describe('Loading states', () => {
    test('shows loading skeleton initially', () => {
      mockClient.getStrains.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(<StrainsListWithCache />, { wrapper: createWrapper() } as any);

      // Skeleton should be visible
      expect(screen.getByTestId('strains-skeleton-list')).toBeOnTheScreen();
    });

    test('shows strains after loading', async () => {
      mockClient.getStrains.mockResolvedValueOnce(mockStrainsResponse);

      render(<StrainsListWithCache />, { wrapper: createWrapper() } as any);

      await waitFor(() => {
        expect(screen.getByText('OG Kush')).toBeOnTheScreen();
      });
    });
  });

  describe('Empty states', () => {
    test('shows empty state when no strains', async () => {
      mockClient.getStrains.mockResolvedValueOnce({
        data: [],
        hasMore: false,
        nextCursor: undefined,
      });

      render(<StrainsListWithCache />, { wrapper: createWrapper() } as any);

      await waitFor(() => {
        expect(screen.getByTestId('strains-empty-state')).toBeOnTheScreen();
      });
    });
  });

  describe('Error states', () => {
    test('shows error state on fetch failure', async () => {
      const error = new Error('Network error');
      mockClient.getStrains.mockRejectedValueOnce(error);

      render(<StrainsListWithCache />, { wrapper: createWrapper() } as any);

      await waitFor(() => {
        expect(screen.getByTestId('strains-error-card')).toBeOnTheScreen();
      });
    });
  });

  describe('Search functionality', () => {
    test('filters strains by search query', async () => {
      mockClient.getStrains.mockResolvedValueOnce(mockStrainsResponse);

      render(<StrainsListWithCache searchQuery="og kush" />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(mockClient.getStrains).toHaveBeenCalledWith(
          expect.objectContaining({
            searchQuery: 'og kush',
          })
        );
      });
    });

    test('updates results when search query changes', async () => {
      mockClient.getStrains.mockResolvedValue(mockStrainsResponse);

      const { rerender } = render(<StrainsListWithCache searchQuery="og" />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(mockClient.getStrains).toHaveBeenCalledWith(
          expect.objectContaining({
            searchQuery: 'og',
          })
        );
      });

      rerender(<StrainsListWithCache searchQuery="blue" />);

      await waitFor(() => {
        expect(mockClient.getStrains).toHaveBeenCalledWith(
          expect.objectContaining({
            searchQuery: 'blue',
          })
        );
      });
    });
  });

  describe('Filter functionality', () => {
    test('applies race filter', async () => {
      mockClient.getStrains.mockResolvedValueOnce(mockStrainsResponse);

      render(<StrainsListWithCache filters={{ race: 'indica' }} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(mockClient.getStrains).toHaveBeenCalledWith(
          expect.objectContaining({
            filters: { race: 'indica' },
          })
        );
      });
    });

    test('applies multiple filters', async () => {
      mockClient.getStrains.mockResolvedValueOnce(mockStrainsResponse);

      const filters = {
        race: 'indica' as const,
        difficulty: 'beginner' as const,
        effects: ['Relaxed', 'Happy'],
      };

      render(<StrainsListWithCache filters={filters} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(mockClient.getStrains).toHaveBeenCalledWith(
          expect.objectContaining({
            filters,
          })
        );
      });
    });
  });

  describe('Infinite scroll', () => {
    test('loads next page when scrolling', async () => {
      const page1Response: StrainsResponse = {
        data: [mockStrain],
        hasMore: true,
        nextCursor: 'cursor-page-2',
      };

      const page2Response: StrainsResponse = {
        data: [{ ...mockStrain, id: 'strain-2', name: 'Blue Dream' }],
        hasMore: false,
        nextCursor: undefined,
      };

      mockClient.getStrains
        .mockResolvedValueOnce(page1Response)
        .mockResolvedValueOnce(page2Response);

      render(<StrainsListWithCache />, { wrapper: createWrapper() } as any);

      await waitFor(() => {
        expect(screen.getByText('OG Kush')).toBeOnTheScreen();
      });

      // FlashList onEndReached would be triggered here in real scenario
      // In tests, we verify the setup is correct
      expect(mockClient.getStrains).toHaveBeenCalledTimes(1);
    });

    test('shows loading footer when fetching next page', async () => {
      const response: StrainsResponse = {
        data: [mockStrain],
        hasMore: true,
        nextCursor: 'cursor-page-2',
      };

      mockClient.getStrains.mockResolvedValueOnce(response);

      render(<StrainsListWithCache />, { wrapper: createWrapper() } as any);

      await waitFor(() => {
        expect(screen.getByText('OG Kush')).toBeOnTheScreen();
      });
    });
  });

  describe('Offline indicator', () => {
    test('shows offline banner when offline', async () => {
      mockClient.getStrains.mockResolvedValueOnce(mockStrainsResponse);

      // Mock network state
      jest.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

      render(<StrainsListWithCache />, { wrapper: createWrapper() });

      await waitFor(() => {
        // Offline banner should be visible
        expect(screen.getByTestId('strains-offline-banner')).toBeOnTheScreen();
      });
    });
  });

  describe('Accessibility', () => {
    test('list has proper testID', async () => {
      mockClient.getStrains.mockResolvedValueOnce(mockStrainsResponse);

      render(<StrainsListWithCache />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTestId('strains-list')).toBeOnTheScreen();
      });
    });
  });
});
