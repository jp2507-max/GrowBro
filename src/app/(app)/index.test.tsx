import type { InfiniteData } from '@tanstack/react-query';
import React from 'react';

import { usePlantsInfinite } from '@/api';
import type { Plant } from '@/api/plants/types';
import type { PaginateQuery } from '@/api/types';
import Feed from '@/app/(app)/index';
import { screen, setup, waitFor } from '@/lib/test-utils';

jest.mock('@/api', () => ({
  usePlantsInfinite: jest.fn(),
}));

jest.mock('@/lib/compliance/activation-state', () => ({
  hydrateActivationState: jest.fn(),
  completeActivationAction: jest.fn(),
}));

jest.mock('@/components/home/home-dashboard', () => ({
  useTaskSnapshot: jest.fn(() => ({
    snapshot: { overdue: 0, today: 1 },
    isLoading: false,
  })),
}));

jest.mock('@/lib/animations/animated-scroll-list-provider', () => ({
  useAnimatedScrollList: jest.fn(() => ({
    resetScrollState: jest.fn(),
  })),
}));

jest.mock('@/lib/animations/use-bottom-tab-bar-height', () => ({
  useBottomTabBarHeight: jest.fn(() => ({
    netHeight: 60,
    grossHeight: 94,
  })),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

type PlantsData = InfiniteData<PaginateQuery<Plant>, string | undefined>;

const basePlantsMock: Partial<ReturnType<typeof usePlantsInfinite>> = {
  data: { pages: [], pageParams: [] } as PlantsData,
  isLoading: false,
  isError: false,
  refetch: jest.fn(),
};

const createPlantsMock = (
  overrides?: Partial<ReturnType<typeof usePlantsInfinite>>
) => ({
  ...basePlantsMock,
  refetch: jest.fn(),
  ...overrides,
});

describe('Home screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (usePlantsInfinite as unknown as jest.Mock).mockReturnValue(
      createPlantsMock()
    );
  });

  test('renders feed screen', async () => {
    setup(<Feed />);

    expect(await screen.findByTestId('feed-screen')).toBeOnTheScreen();
  });

  test('renders FAB button', async () => {
    setup(<Feed />);

    expect(await screen.findByTestId('add-plant-fab')).toBeOnTheScreen();
  });

  test('FAB navigates to add plant screen when pressed', async () => {
    const { user } = setup(<Feed />);

    const fab = await screen.findByTestId('add-plant-fab');
    await user.press(fab);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/plants/add');
    });
  });

  test('shows empty state when no plants', async () => {
    (usePlantsInfinite as unknown as jest.Mock).mockReturnValue(
      createPlantsMock({
        data: { pages: [], pageParams: [] } as PlantsData,
      })
    );

    setup(<Feed />);

    expect(await screen.findByTestId('home-empty-state')).toBeOnTheScreen();
  });

  test('shows plants section when plants exist', async () => {
    (usePlantsInfinite as unknown as jest.Mock).mockReturnValue(
      createPlantsMock({
        data: {
          pages: [
            {
              results: [{ id: '1', name: 'Test Plant' } as Plant],
              count: 1,
              next: null,
              previous: null,
            },
          ],
          pageParams: [undefined],
        } as PlantsData,
      })
    );

    setup(<Feed />);

    expect(await screen.findByTestId('plants-section')).toBeOnTheScreen();
  });

  test('shows error card when plants fail to load', async () => {
    const refetchMock = jest.fn();
    (usePlantsInfinite as unknown as jest.Mock).mockReturnValue(
      createPlantsMock({
        isError: true,
        refetch: refetchMock,
      })
    );

    const { user } = setup(<Feed />);

    expect(await screen.findByTestId('plants-error-card')).toBeOnTheScreen();

    const retryButton = await screen.findByTestId('plants-error-card-retry');
    await user.press(retryButton);

    await waitFor(() => {
      expect(refetchMock).toHaveBeenCalled();
    });
  });
});
