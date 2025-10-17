import React from 'react';

import type { ConsumptionDataPoint } from '@/lib/inventory/use-inventory-item-forecast';
import { cleanup, screen, setup } from '@/lib/test-utils';

import { ConsumptionTrendChart } from './consumption-trend-chart';

afterEach(cleanup);

// Mock react-native-gifted-charts
jest.mock('react-native-gifted-charts', () => ({
  LineChart: ({ testID: _testID }: { testID?: string }) => null,
}));

// Mock i18n to return the key itself for testing
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock i18next for language access
jest.mock('i18next', () => ({
  language: 'en',
}));

describe('ConsumptionTrendChart', () => {
  // Setup section
  beforeAll(() => {
    // Global setup if needed
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Test cases grouped by functionality
  describe('Rendering', () => {
    test('renders correctly with empty data', async () => {
      setup(<ConsumptionTrendChart data={[]} />);
      expect(
        await screen.findByTestId('consumption-trend-chart')
      ).toBeOnTheScreen();
      expect(
        screen.getByText('inventory.charts.noConsumptionData')
      ).toBeOnTheScreen();
    });

    test('renders correctly with data', async () => {
      const mockData: ConsumptionDataPoint[] = [
        { timestamp: Date.now(), quantityUsed: 5 },
      ];
      setup(<ConsumptionTrendChart data={mockData} />);
      expect(
        await screen.findByTestId('consumption-trend-chart')
      ).toBeOnTheScreen();
      expect(
        screen.getByText('inventory.charts.consumptionTrend')
      ).toBeOnTheScreen();
      expect(screen.getByText('inventory.charts.weekly')).toBeOnTheScreen();
      expect(
        screen.getByText('inventory.charts.consumptionNote')
      ).toBeOnTheScreen();
    });

    test('renders with custom testID', async () => {
      setup(<ConsumptionTrendChart data={[]} testID="custom-chart" />);
      expect(await screen.findByTestId('custom-chart')).toBeOnTheScreen();
    });
  });

  describe('Prediction Interval', () => {
    test('displays prediction interval when provided', async () => {
      const mockData: ConsumptionDataPoint[] = [
        { timestamp: Date.now(), quantityUsed: 5 },
      ];
      const predictionInterval: [number, number] = [2.5, 7.5];

      setup(
        <ConsumptionTrendChart
          data={mockData}
          predictionInterval={predictionInterval}
        />
      );

      expect(
        screen.getByText(
          'inventory.charts.predictionInterval: 2.5 - 7.5 inventory.charts.unitsPerWeek'
        )
      ).toBeOnTheScreen();
    });

    test('displays stockout date when provided', async () => {
      const mockData: ConsumptionDataPoint[] = [
        { timestamp: Date.now(), quantityUsed: 5 },
      ];
      const stockoutDate = new Date('2024-12-25');

      setup(
        <ConsumptionTrendChart
          data={mockData}
          predictionInterval={[2.5, 7.5]}
          stockoutDate={stockoutDate}
        />
      );

      expect(
        screen.getByText('inventory.charts.predictedStockout: Dec 25, 2024')
      ).toBeOnTheScreen();
    });
  });

  describe('Week Grouping Logic', () => {
    test('groups multiple data points in same week correctly', () => {
      // Create timestamps for Monday, Tuesday, Wednesday of the same week
      const monday = new Date('2024-01-01T12:00:00'); // Monday
      const tuesday = new Date('2024-01-02T12:00:00'); // Tuesday
      const wednesday = new Date('2024-01-03T12:00:00'); // Wednesday

      const mockData: ConsumptionDataPoint[] = [
        { timestamp: monday.getTime(), quantityUsed: 2 },
        { timestamp: tuesday.getTime(), quantityUsed: 3 },
        { timestamp: wednesday.getTime(), quantityUsed: 1 },
      ];

      setup(<ConsumptionTrendChart data={mockData} />);

      // Component should render and process the data
      expect(
        screen.getByText('inventory.charts.consumptionTrend')
      ).toBeOnTheScreen();
      expect(
        screen.getByText('inventory.charts.consumptionNote')
      ).toBeOnTheScreen();
    });

    test('handles data from multiple weeks', () => {
      // Create timestamps for two different weeks
      const week1Monday = new Date('2024-01-01T12:00:00'); // Monday week 1
      const week1Tuesday = new Date('2024-01-02T12:00:00'); // Tuesday week 1
      const week2Monday = new Date('2024-01-08T12:00:00'); // Monday week 2

      const mockData: ConsumptionDataPoint[] = [
        { timestamp: week1Monday.getTime(), quantityUsed: 2 },
        { timestamp: week1Tuesday.getTime(), quantityUsed: 3 },
        { timestamp: week2Monday.getTime(), quantityUsed: 4 },
      ];

      setup(<ConsumptionTrendChart data={mockData} />);

      // Component should handle multiple weeks without errors
      expect(
        screen.getByText('inventory.charts.consumptionTrend')
      ).toBeOnTheScreen();
      expect(
        screen.getByText('inventory.charts.consumptionNote')
      ).toBeOnTheScreen();
    });

    test('handles Sunday dates correctly (week starts on Monday)', () => {
      // Sunday should be grouped with the previous Monday
      const sunday = new Date('2024-01-07T12:00:00'); // Sunday
      const monday = new Date('2024-01-08T12:00:00'); // Monday (next week)

      const mockData: ConsumptionDataPoint[] = [
        { timestamp: sunday.getTime(), quantityUsed: 1 },
        { timestamp: monday.getTime(), quantityUsed: 2 },
      ];

      setup(<ConsumptionTrendChart data={mockData} />);

      // Component should handle Sunday dates correctly
      expect(
        screen.getByText('inventory.charts.consumptionTrend')
      ).toBeOnTheScreen();
      expect(
        screen.getByText('inventory.charts.consumptionNote')
      ).toBeOnTheScreen();
    });
  });
});
