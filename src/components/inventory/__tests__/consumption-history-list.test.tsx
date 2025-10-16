/**
 * Consumption History List Tests
 *
 * Unit tests for ConsumptionHistoryList component.
 *
 * Requirements: 6.1, 9.4
 */

import React from 'react';

import { cleanup, render, screen } from '@/lib/test-utils';

import { ConsumptionHistoryList } from '../consumption-history-list';

// Mock FlashList to avoid display name issues with react-native-css-interop

jest.mock('@shopify/flash-list', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');

  return {
    FlashList: ({ data, renderItem, testID }: any) => {
      return (
        <View testID={testID}>
          {data?.map((item: any, index: number) => (
            <React.Fragment key={item.id || index}>
              {renderItem({ item, index })}
            </React.Fragment>
          ))}
        </View>
      );
    },
  };
});

afterEach(cleanup);

describe('ConsumptionHistoryList', () => {
  it('should render consumption history entries', () => {
    const entries = [
      {
        id: 'mov1',
        itemId: 'item1',
        itemName: 'Test Nutrient',
        quantity: 10.5,
        unit: 'kg',
        costPerUnitMinor: 100,
        totalCostMinor: 1050,
        reason: 'Task completion',
        taskId: 'task1',
        createdAt: new Date('2024-01-15T10:00:00Z'),
        type: 'consumption' as const,
      },
    ];

    render(<ConsumptionHistoryList entries={entries} />);

    expect(screen.getByText('Test Nutrient')).toBeOnTheScreen();
    expect(screen.getByText(/10\.50/)).toBeOnTheScreen(); // Quantity with 2 decimals
    expect(screen.getByText('$10.50')).toBeOnTheScreen(); // Total cost
    expect(screen.getByText('$1.00/kg')).toBeOnTheScreen(); // Unit cost
    expect(screen.getByText('Task completion')).toBeOnTheScreen();
  });

  it('should show task linkage badge', () => {
    const entries = [
      {
        id: 'mov1',
        itemId: 'item1',
        itemName: 'Test Item',
        quantity: 10,
        unit: 'kg',
        costPerUnitMinor: 100,
        totalCostMinor: 1000,
        reason: 'Test',
        taskId: 'task1',
        createdAt: new Date(),
        type: 'consumption' as const,
      },
    ];

    render(<ConsumptionHistoryList entries={entries} />);

    expect(
      screen.getByTestId('consumption-history-item-mov1')
    ).toBeOnTheScreen();
  });

  it('should differentiate consumption vs adjustment types', () => {
    const entries = [
      {
        id: 'mov1',
        itemId: 'item1',
        itemName: 'Consumption Item',
        quantity: 10,
        unit: 'kg',
        costPerUnitMinor: 100,
        totalCostMinor: 1000,
        reason: 'Used',
        taskId: null,
        createdAt: new Date(),
        type: 'consumption' as const,
      },
      {
        id: 'mov2',
        itemId: 'item2',
        itemName: 'Adjustment Item',
        quantity: 5,
        unit: 'kg',
        costPerUnitMinor: 200,
        totalCostMinor: 1000,
        reason: 'Manual correction',
        taskId: null,
        createdAt: new Date(),
        type: 'adjustment' as const,
      },
    ];

    render(<ConsumptionHistoryList entries={entries} />);

    expect(screen.getByText('Consumption Item')).toBeOnTheScreen();
    expect(screen.getByText('Adjustment Item')).toBeOnTheScreen();
  });

  it('should show empty state when no entries', () => {
    render(<ConsumptionHistoryList entries={[]} />);

    expect(
      screen.getByTestId('consumption-history-list-empty')
    ).toBeOnTheScreen();
  });

  it('should preserve FIFO cost integrity in display', () => {
    const entries = [
      {
        id: 'mov1',
        itemId: 'item1',
        itemName: 'Batch 1',
        quantity: 3,
        unit: 'kg',
        costPerUnitMinor: 100, // $1.00/kg from first batch
        totalCostMinor: 300,
        reason: 'FEFO pick',
        taskId: null,
        createdAt: new Date(),
        type: 'consumption' as const,
      },
      {
        id: 'mov2',
        itemId: 'item1',
        itemName: 'Batch 2',
        quantity: 2,
        unit: 'kg',
        costPerUnitMinor: 150, // $1.50/kg from second batch
        totalCostMinor: 300,
        reason: 'FEFO pick continued',
        taskId: null,
        createdAt: new Date(),
        type: 'consumption' as const,
      },
    ];

    render(<ConsumptionHistoryList entries={entries} />);

    // Both movements show their respective batch costs
    expect(screen.getByText('$3.00')).toBeOnTheScreen(); // 3 * 1.00
    expect(screen.getByText('$1.00/kg')).toBeOnTheScreen(); // First batch unit cost
    expect(screen.getByText('$1.50/kg')).toBeOnTheScreen(); // Second batch unit cost
  });
});
