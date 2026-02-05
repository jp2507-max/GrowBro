import React from 'react';
import { View } from 'react-native';

import type { Plant } from '@/api/plants/types';
import { cleanup, fireEvent, screen, setup } from '@/lib/test-utils';

import { PlantDetailDashboard } from './plant-detail-dashboard';

// Mock child components to verify props and avoid deep rendering
jest.mock('./plant-detail-header', () => ({
  PlantDetailHeader: () => <View testID="mock-plant-detail-header" />,
}));
jest.mock('./plant-action-hub', () => ({
  PlantActionHub: () => <View testID="mock-plant-action-hub" />,
}));
jest.mock('./plant-stats-grid', () => ({
  PlantStatsGrid: () => <View testID="mock-plant-stats-grid" />,
}));

const mockPlant: Plant = {
  id: 'plant-1',
  name: 'Karl',
  strain: 'Acapulco Gold',
  stage: 'seedling',
  plantedAt: new Date().toISOString(),
  imageUrl: 'file://img.jpg',
  metadata: {},
};

describe('PlantDetailDashboard', () => {
  const mockProps = {
    plant: mockPlant,
    nextFeedHours: 4,
    tasks: [],
    onBack: jest.fn(),
    onTaskPress: jest.fn(),
    onHarvestPress: jest.fn(),
    onAdvancedSettings: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders correctly', () => {
    setup(<PlantDetailDashboard {...mockProps} />);

    // Check if main children are rendered
    expect(screen.getByTestId('mock-plant-detail-header')).toBeTruthy();
    expect(screen.getByTestId('mock-plant-action-hub')).toBeTruthy();
    expect(screen.getByTestId('mock-plant-stats-grid')).toBeTruthy();

    // Check advanced settings button
    expect(screen.getByTestId('plant-settings-button')).toBeTruthy();
  });

  it('calls onAdvancedSettings when footer button is pressed', () => {
    setup(<PlantDetailDashboard {...mockProps} />);

    fireEvent.press(screen.getByTestId('plant-settings-button'));
    expect(mockProps.onAdvancedSettings).toHaveBeenCalled();
  });
});
