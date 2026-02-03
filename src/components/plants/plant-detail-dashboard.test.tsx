import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import type { Plant } from '@/api/plants/types';

import { PlantDetailDashboard } from './plant-detail-dashboard';

// Mock child components to verify props and avoid deep rendering
jest.mock('./plant-detail-header', () => ({
  PlantDetailHeader: () => <mock-PlantDetailHeader />,
}));
jest.mock('./plant-action-hub', () => ({
  PlantActionHub: () => <mock-PlantActionHub />,
}));
jest.mock('./plant-stats-grid', () => ({
  PlantStatsGrid: () => <mock-PlantStatsGrid />,
}));

const mockPlant: Plant = {
  id: 'plant-1',
  name: 'Karl',
  strain: 'Acapulco Gold',
  stage: 'seedling',
  plantedAt: new Date().toISOString(),
  imageUrl: 'file://img.jpg',
  metadata: {},
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
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

  it('renders correctly', () => {
    render(<PlantDetailDashboard {...mockProps} />);

    // Check if main children are rendered
    expect(screen.UNSAFE_getByType('mock-PlantDetailHeader')).toBeTruthy();
    expect(screen.UNSAFE_getByType('mock-PlantActionHub')).toBeTruthy();
    expect(screen.UNSAFE_getByType('mock-PlantStatsGrid')).toBeTruthy();

    // Check advanced settings button
    expect(screen.getByTestId('plant-advanced-settings')).toBeTruthy();
  });

  it('calls onAdvancedSettings when footer button is pressed', () => {
    render(<PlantDetailDashboard {...mockProps} />);

    fireEvent.press(screen.getByTestId('plant-advanced-settings'));
    expect(mockProps.onAdvancedSettings).toHaveBeenCalled();
  });
});
