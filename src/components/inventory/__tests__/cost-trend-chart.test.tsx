/**
 * Cost Trend Chart Tests
 *
 * Unit tests for CostTrendChart component.
 *
 * Requirements: 9.4
 */

import React from 'react';

import { cleanup, render, screen } from '@/lib/test-utils';

import { CostTrendChart } from '../cost-trend-chart';

afterEach(cleanup);

describe('CostTrendChart', () => {
  it('should render cost trends by category', () => {
    const data = [
      {
        category: 'Nutrients',
        dataPoints: [
          {
            date: new Date('2024-01-08'),
            label: 'W2',
            costMinor: 10000,
            quantity: 100,
          },
          {
            date: new Date('2024-01-15'),
            label: 'W3',
            costMinor: 15000,
            quantity: 150,
          },
        ],
      },
      {
        category: 'Tools',
        dataPoints: [
          {
            date: new Date('2024-01-08'),
            label: 'W2',
            costMinor: 5000,
            quantity: 50,
          },
        ],
      },
    ];

    render(<CostTrendChart data={data} bucketType="week" />);

    expect(screen.getByTestId('cost-trend-chart')).toBeOnTheScreen();
    expect(screen.getByText('Nutrients')).toBeOnTheScreen();
    expect(screen.getByText('Tools')).toBeOnTheScreen();
  });

  it('should show empty state when no data', () => {
    render(<CostTrendChart data={[]} bucketType="week" />);

    expect(screen.getByTestId('cost-trend-chart')).toBeOnTheScreen();
  });

  it('should support weekly and monthly bucketing', () => {
    const data = [
      {
        category: 'Nutrients',
        dataPoints: [
          {
            date: new Date('2024-01-01'),
            label: 'W1',
            costMinor: 10000,
            quantity: 100,
          },
        ],
      },
    ];

    const { rerender } = render(
      <CostTrendChart data={data} bucketType="week" />
    );
    expect(screen.getByTestId('cost-trend-chart')).toBeOnTheScreen();

    rerender(<CostTrendChart data={data} bucketType="month" />);
    expect(screen.getByTestId('cost-trend-chart')).toBeOnTheScreen();
  });

  it('should display category legend', () => {
    const data = [
      {
        category: 'Nutrients',
        dataPoints: [
          {
            date: new Date('2024-01-01'),
            label: 'W1',
            costMinor: 10000,
            quantity: 100,
          },
        ],
      },
      {
        category: 'Tools',
        dataPoints: [
          {
            date: new Date('2024-01-01'),
            label: 'W1',
            costMinor: 5000,
            quantity: 50,
          },
        ],
      },
      {
        category: 'Seeds',
        dataPoints: [
          {
            date: new Date('2024-01-01'),
            label: 'W1',
            costMinor: 8000,
            quantity: 80,
          },
        ],
      },
    ];

    render(<CostTrendChart data={data} bucketType="week" />);

    expect(screen.getByText('Nutrients')).toBeOnTheScreen();
    expect(screen.getByText('Tools')).toBeOnTheScreen();
    expect(screen.getByText('Seeds')).toBeOnTheScreen();
  });
});
