import React from 'react';

import type { Plant } from '@/api';
import { PlantCard } from '@/components/plants';
import { usePlantAttention } from '@/lib/hooks/use-plant-attention';
import { cleanup, screen, setup } from '@/lib/test-utils';

// Mock usePlantAttention to avoid async state updates in tests
jest.mock('@/lib/hooks/use-plant-attention', () => ({
  usePlantAttention: jest.fn(() => ({
    needsAttention: false,
    overdueCount: 0,
    dueTodayCount: 0,
    isLoading: false,
  })),
}));

const mockUsePlantAttention = usePlantAttention as jest.MockedFunction<
  typeof usePlantAttention
>;

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

const basePlant: Plant = {
  id: 'plant-1',
  name: 'Bobby',
  stage: 'harvesting',
  strain: 'OG Kush',
  environment: 'indoor',
  photoperiodType: 'photoperiod',
};

describe('PlantCard', () => {
  test('renders stage badge, strain, and placeholder when no image', async () => {
    setup(<PlantCard plant={basePlant} onPress={jest.fn()} />);

    expect(await screen.findByTestId('plant-card-plant-1')).toBeOnTheScreen();
    expect(screen.getByText('Bobby')).toBeOnTheScreen();
    expect(screen.getByText('OG Kush')).toBeOnTheScreen();
    expect(
      screen.getByTestId('plant-card-plant-1-stage-label')
    ).toHaveTextContent('Harvesting');
    expect(
      screen.getByTestId('plant-card-plant-1-placeholder')
    ).toBeOnTheScreen();
  });

  test('renders image when imageUrl is provided', async () => {
    const plantWithImage: Plant = {
      ...basePlant,
      id: 'plant-2',
      imageUrl: 'https://example.com/photo.jpg',
    };

    setup(<PlantCard plant={plantWithImage} onPress={jest.fn()} />);

    expect(
      await screen.findByTestId('plant-card-plant-2-image')
    ).toBeOnTheScreen();
    expect(
      screen.queryByTestId('plant-card-plant-2-placeholder')
    ).not.toBeOnTheScreen();
  });

  test('calls onPress with the plant id', async () => {
    const onPress = jest.fn();
    const { user } = setup(<PlantCard plant={basePlant} onPress={onPress} />);

    await user.press(await screen.findByTestId('plant-card-plant-1'));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledWith('plant-1');
  });

  test('shows attention indicator when plant has pending tasks', async () => {
    mockUsePlantAttention.mockReturnValue({
      needsAttention: true,
      overdueCount: 1,
      dueTodayCount: 2,
      isLoading: false,
    });

    setup(<PlantCard plant={basePlant} onPress={jest.fn()} />);

    expect(await screen.findByTestId('plant-card-plant-1')).toBeOnTheScreen();
    // Footer should show attention state with water icon
    expect(screen.getByText('💧')).toBeOnTheScreen();
  });

  test('shows all good state when plant has no pending tasks', async () => {
    mockUsePlantAttention.mockReturnValue({
      needsAttention: false,
      overdueCount: 0,
      dueTodayCount: 0,
      isLoading: false,
    });

    setup(<PlantCard plant={basePlant} onPress={jest.fn()} />);

    expect(await screen.findByTestId('plant-card-plant-1')).toBeOnTheScreen();
    // Footer should show checkmark for all good state
    expect(screen.getByText('✓')).toBeOnTheScreen();
  });
});
