import React from 'react';

import type { Plant } from '@/api';
import { PlantCard } from '@/components/plants';
import { cleanup, screen, setup } from '@/lib/test-utils';

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

  test('shows attention indicator when needsAttention is true', async () => {
    setup(
      <PlantCard plant={basePlant} onPress={jest.fn()} needsAttention={true} />
    );

    expect(await screen.findByTestId('plant-card-plant-1')).toBeOnTheScreen();
    // Footer should show attention state with water icon
    expect(screen.getByText('💧')).toBeOnTheScreen();
  });

  test('shows all good state when needsAttention is false', async () => {
    setup(
      <PlantCard plant={basePlant} onPress={jest.fn()} needsAttention={false} />
    );

    expect(await screen.findByTestId('plant-card-plant-1')).toBeOnTheScreen();
    // Footer should show checkmark for all good state
    expect(screen.getByText('✓')).toBeOnTheScreen();
  });

  test('defaults to false when needsAttention is not provided', async () => {
    setup(<PlantCard plant={basePlant} onPress={jest.fn()} />);

    expect(await screen.findByTestId('plant-card-plant-1')).toBeOnTheScreen();
    // Footer should show checkmark for all good state (default)
    expect(screen.getByText('✓')).toBeOnTheScreen();
  });
});
