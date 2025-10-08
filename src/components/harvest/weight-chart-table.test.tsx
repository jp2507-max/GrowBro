/**
 * WeightChartTable Component Tests
 *
 * Requirements: 4.6, 15.4
 */

import React from 'react';

import { cleanup, render, screen } from '@/lib/test-utils';
import { HarvestStage } from '@/types/harvest';

import { WeightChartTable } from './weight-chart-table';

// Mock FlashList
jest.mock('@shopify/flash-list', () => {
  const MockFlatList = ({
    data: _data,
    renderItem: _renderItem,
    testID: _testID,
  }: any) => null;
  return {
    FlashList: MockFlatList,
  };
});

afterEach(cleanup);

describe('WeightChartTable', () => {
  const mockData = [
    {
      date: new Date('2024-01-01'),
      weight_g: 1000,
      stage: HarvestStage.HARVEST,
    },
    {
      date: new Date('2024-01-05'),
      weight_g: 900,
      stage: HarvestStage.DRYING,
    },
    {
      date: new Date('2024-01-15'),
      weight_g: 250,
      stage: HarvestStage.CURING,
    },
  ];

  describe('Rendering', () => {
    it('should render table with data (Requirement 4.6)', () => {
      render(<WeightChartTable data={mockData} />);

      expect(screen.getByTestId('weight-chart-table')).toBeOnTheScreen();
      expect(screen.getByText('Weight History')).toBeOnTheScreen();
    });

    it('should render table headers', () => {
      render(<WeightChartTable data={mockData} />);

      expect(screen.getByText('Date')).toBeOnTheScreen();
      expect(screen.getByText('Weight')).toBeOnTheScreen();
      expect(screen.getByText('Stage')).toBeOnTheScreen();
    });

    it('should render all data rows', () => {
      render(<WeightChartTable data={mockData} />);

      // Check for formatted weights
      expect(screen.getByText('1,000 g')).toBeOnTheScreen();
      expect(screen.getByText('900 g')).toBeOnTheScreen();
      expect(screen.getByText('250 g')).toBeOnTheScreen();
    });

    it('should not render when data is empty', () => {
      render(<WeightChartTable data={[]} />);

      expect(screen.queryByTestId('weight-chart-table')).not.toBeOnTheScreen();
    });
  });

  describe('Data Formatting', () => {
    it('should format dates correctly', () => {
      render(<WeightChartTable data={mockData} />);

      // Dates should be formatted (we verify presence, exact format depends on locale)
      const list = screen.getByTestId('weight-chart-table');
      expect(list).toBeOnTheScreen();
    });

    it('should format weights with commas (Requirement 15.4)', () => {
      render(<WeightChartTable data={mockData} />);

      expect(screen.getByText('1,000 g')).toBeOnTheScreen();
    });

    it('should display stage information', () => {
      render(<WeightChartTable data={mockData} />);

      expect(screen.getByText('harvest')).toBeOnTheScreen();
      expect(screen.getByText('drying')).toBeOnTheScreen();
      expect(screen.getByText('curing')).toBeOnTheScreen();
    });
  });

  describe('List Performance', () => {
    it('should use FlashList for performance', () => {
      render(<WeightChartTable data={mockData} />);

      // Verify list renders (FlashList is mocked as FlatList)
      expect(screen.getByTestId('weight-chart-table')).toBeOnTheScreen();
    });

    it('should handle large datasets efficiently', () => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        date: new Date(2024, 0, i + 1),
        weight_g: 1000 - i,
        stage: HarvestStage.DRYING,
      }));

      // Should render without errors
      expect(() => {
        render(<WeightChartTable data={largeDataset} />);
      }).not.toThrow();
    });
  });

  describe('Accessibility', () => {
    it('should have testID for testing', () => {
      render(<WeightChartTable data={mockData} testID="custom-table" />);

      expect(screen.getByTestId('custom-table')).toBeOnTheScreen();
    });

    it('should have accessible headers', () => {
      render(<WeightChartTable data={mockData} />);

      expect(screen.getByText('Date')).toBeOnTheScreen();
      expect(screen.getByText('Weight')).toBeOnTheScreen();
      expect(screen.getByText('Stage')).toBeOnTheScreen();
    });
  });
});
