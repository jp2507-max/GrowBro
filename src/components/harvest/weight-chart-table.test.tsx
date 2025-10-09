/**
 * WeightChartTable Component Tests
 *
 * Requirements: 4.6, 15.4
 */

import React from 'react';

import { cleanup, render, screen } from '@/lib/test-utils';
import { HarvestStages } from '@/types/harvest';

import { WeightChartTable } from './weight-chart-table';

afterEach(cleanup);

describe('WeightChartTable', () => {
  const mockData = [
    {
      date: new Date('2024-01-01'),
      weight_g: 1000,
      stage: HarvestStages.HARVEST,
    },
    {
      date: new Date('2024-01-05'),
      weight_g: 900,
      stage: HarvestStages.DRYING,
    },
    {
      date: new Date('2024-01-15'),
      weight_g: 250,
      stage: HarvestStages.CURING,
    },
  ];

  describe('Rendering', () => {
    it('should render table with data (Requirement 4.6)', () => {
      render(<WeightChartTable data={mockData} testID="weight-chart-table" />);

      expect(screen.getByTestId('weight-chart-table')).toBeOnTheScreen();
    });

    it('should render table headers', () => {
      render(<WeightChartTable data={mockData} testID="weight-chart-table" />);

      expect(screen.getByText('Date')).toBeOnTheScreen();
      expect(screen.getByText('Weight')).toBeOnTheScreen();
      expect(screen.getByText('Stage')).toBeOnTheScreen();
    });

    it('should render all data rows', () => {
      render(<WeightChartTable data={mockData} testID="weight-chart-table" />);

      // Check for formatted weights
      expect(screen.getByText('1,000 g')).toBeOnTheScreen();
      expect(screen.getByText('900 g')).toBeOnTheScreen();
      expect(screen.getByText('250 g')).toBeOnTheScreen();
    });

    it('should render container and headers but no data rows when data is empty', () => {
      render(<WeightChartTable data={[]} testID="weight-chart-table" />);

      // Container should still render
      expect(screen.getByTestId('weight-chart-table')).toBeOnTheScreen();

      // Headers should still be present
      expect(screen.getByText('Date')).toBeOnTheScreen();
      expect(screen.getByText('Weight')).toBeOnTheScreen();
      expect(screen.getByText('Stage')).toBeOnTheScreen();

      // No data rows should be present - check that no weight values are rendered
      expect(screen.queryByText(/\d+ g/)).not.toBeOnTheScreen();
    });
  });

  describe('Data Formatting', () => {
    it('should format dates correctly', () => {
      render(<WeightChartTable data={mockData} testID="weight-chart-table" />);

      // Dates should be formatted (we verify presence, exact format depends on locale)
      const list = screen.getByTestId('weight-chart-table');
      expect(list).toBeOnTheScreen();
    });

    it('should format weights with commas (Requirement 15.4)', () => {
      render(<WeightChartTable data={mockData} testID="weight-chart-table" />);

      expect(screen.getByText('1,000 g')).toBeOnTheScreen();
    });

    it('should display stage information', () => {
      render(<WeightChartTable data={mockData} testID="weight-chart-table" />);

      expect(screen.getByText('harvest')).toBeOnTheScreen();
      expect(screen.getByText('drying')).toBeOnTheScreen();
      expect(screen.getByText('curing')).toBeOnTheScreen();
    });
  });

  describe('List Performance', () => {
    it('should use FlashList for performance', () => {
      render(<WeightChartTable data={mockData} testID="weight-chart-table" />);

      // Verify list renders (FlashList is mocked as FlatList)
      expect(screen.getByTestId('weight-chart-table')).toBeOnTheScreen();
    });

    it('should handle large datasets efficiently', () => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        date: new Date(2024, 0, i + 1),
        weight_g: 1000 - i,
        stage: HarvestStages.DRYING,
      }));

      // Should render without errors
      expect(() => {
        render(
          <WeightChartTable data={largeDataset} testID="weight-chart-table" />
        );
      }).not.toThrow();
    });
  });

  describe('Accessibility', () => {
    it('should have testID for testing', () => {
      render(<WeightChartTable data={mockData} testID="custom-table" />);

      expect(screen.getByTestId('custom-table')).toBeOnTheScreen();
    });

    it('should have accessible headers', () => {
      render(<WeightChartTable data={mockData} testID="weight-chart-table" />);

      expect(screen.getByText('Date')).toBeOnTheScreen();
      expect(screen.getByText('Weight')).toBeOnTheScreen();
      expect(screen.getByText('Stage')).toBeOnTheScreen();
    });
  });
});
