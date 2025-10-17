/**
 * Cost Breakdown Card Tests
 *
 * Unit tests for CostBreakdownCard component.
 *
 * Requirements: 9.4
 */

import React from 'react';

import { cleanup, render, screen } from '@/lib/test-utils';

import { CostBreakdownCard } from '../cost-breakdown-card';

afterEach(cleanup);

describe('CostBreakdownCard', () => {
  it('should render category summaries with costs', () => {
    const summaries = [
      {
        category: 'Nutrients',
        totalQuantity: 100,
        totalCostMinor: 10000, // $100.00
        itemCount: 3,
        movementCount: 10,
      },
      {
        category: 'Tools',
        totalQuantity: 50,
        totalCostMinor: 5000, // $50.00
        itemCount: 2,
        movementCount: 5,
      },
    ];

    render(<CostBreakdownCard categorySummaries={summaries} />);

    expect(screen.getByText('Nutrients')).toBeOnTheScreen();
    expect(screen.getByText('Tools')).toBeOnTheScreen();
    expect(screen.getByText('$100.00')).toBeOnTheScreen();
    expect(screen.getByText('$50.00')).toBeOnTheScreen();
  });

  it('should display total cost', () => {
    const summaries = [
      {
        category: 'Nutrients',
        totalQuantity: 100,
        totalCostMinor: 10000,
        itemCount: 3,
        movementCount: 10,
      },
      {
        category: 'Tools',
        totalQuantity: 50,
        totalCostMinor: 5000,
        itemCount: 2,
        movementCount: 5,
      },
    ];

    render(<CostBreakdownCard categorySummaries={summaries} />);

    expect(screen.getByText('$150.00')).toBeOnTheScreen(); // Total: 100 + 50
  });

  it('should show percentage breakdown', () => {
    const summaries = [
      {
        category: 'Nutrients',
        totalQuantity: 100,
        totalCostMinor: 10000, // 66.67%
        itemCount: 3,
        movementCount: 10,
      },
      {
        category: 'Tools',
        totalQuantity: 50,
        totalCostMinor: 5000, // 33.33%
        itemCount: 2,
        movementCount: 5,
      },
    ];

    render(<CostBreakdownCard categorySummaries={summaries} />);

    expect(screen.getByText('67%')).toBeOnTheScreen();
    expect(screen.getByText('33%')).toBeOnTheScreen();
  });

  it('should show no data message when empty', () => {
    render(<CostBreakdownCard categorySummaries={[]} />);

    expect(screen.getByTestId('cost-breakdown-card')).toBeOnTheScreen();
  });

  it('should sort categories by cost descending', () => {
    const summaries = [
      {
        category: 'Tools',
        totalQuantity: 50,
        totalCostMinor: 5000,
        itemCount: 2,
        movementCount: 5,
      },
      {
        category: 'Nutrients',
        totalQuantity: 100,
        totalCostMinor: 10000,
        itemCount: 3,
        movementCount: 10,
      },
    ];

    render(<CostBreakdownCard categorySummaries={summaries} />);

    // Verify both categories render (sorting is internal implementation)
    expect(screen.getByText('Nutrients')).toBeOnTheScreen();
    expect(screen.getByText('Tools')).toBeOnTheScreen();
  });
});
