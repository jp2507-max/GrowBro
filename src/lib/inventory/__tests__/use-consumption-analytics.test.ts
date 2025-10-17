/**
 * Consumption Analytics Hook Tests
 *
 * Unit tests for useConsumptionAnalytics hook.
 *
 * Requirements: 6.1, 6.3, 9.4
 */

import { renderHook, waitFor } from '@testing-library/react-native';

import * as ConsumptionHistory from '../consumption-history';
import * as CostAnalysisService from '../cost-analysis-service';
import { ForecastingService } from '../forecasting-service';
import { useConsumptionAnalytics } from '../use-consumption-analytics';

// Mock dependencies
jest.mock('@nozbe/watermelondb/react', () => ({
  useDatabase: jest.fn(() => ({}) as any),
}));

jest.mock('../consumption-history');
jest.mock('../cost-analysis-service');
jest.mock('../forecasting-service');

describe('useConsumptionAnalytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch consumption history and analytics', async () => {
    const mockHistory = [
      {
        id: 'mov1',
        itemId: 'item1',
        itemName: 'Test Item',
        quantity: 10,
        unit: 'kg',
        costPerUnitMinor: 100,
        totalCostMinor: 1000,
        reason: 'Test',
        taskId: null,
        createdAt: new Date(),
        type: 'consumption' as const,
      },
    ];

    const mockCategorySummaries = [
      {
        category: 'Nutrients',
        totalQuantity: 10,
        totalCostMinor: 1000,
        itemCount: 1,
        movementCount: 1,
      },
    ];

    const mockCategoryTotals = new Map([
      ['Nutrients', { quantity: 10, costMinor: 1000 }],
    ]);

    jest
      .spyOn(ConsumptionHistory, 'getConsumptionHistory')
      .mockResolvedValue(mockHistory);
    jest
      .spyOn(CostAnalysisService, 'getCategoryCostSummaries')
      .mockResolvedValue(mockCategorySummaries);
    jest
      .spyOn(ConsumptionHistory, 'getConsumptionByCategory')
      .mockResolvedValue(mockCategoryTotals);

    const { result } = renderHook(() => useConsumptionAnalytics({}));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.history).toEqual(mockHistory);
    expect(result.current.categorySummaries).toEqual(mockCategorySummaries);
    expect(result.current.categoryTotals).toEqual(mockCategoryTotals);
  });

  it('should fetch item-specific data when itemId provided', async () => {
    const mockItemSummary = {
      itemId: 'item1',
      itemName: 'Test Item',
      totalQuantity: 10,
      totalCostMinor: 1000,
      avgCostPerUnitMinor: 100,
      movementCount: 1,
    };

    const mockConsumptionRate = {
      dailyRate: 1.5,
      method: 'SMA' as const,
      confidence: 'medium' as const,
      dataPoints: 14,
    };

    jest
      .spyOn(ConsumptionHistory, 'getConsumptionHistory')
      .mockResolvedValue([]);
    jest
      .spyOn(CostAnalysisService, 'getItemCostSummary')
      .mockResolvedValue(mockItemSummary);
    jest
      .spyOn(CostAnalysisService, 'getCategoryCostSummaries')
      .mockResolvedValue([]);
    jest
      .spyOn(ConsumptionHistory, 'getConsumptionByCategory')
      .mockResolvedValue(new Map());

    ForecastingService.prototype.calculateConsumptionRate = jest
      .fn()
      .mockResolvedValue(mockConsumptionRate);

    const { result } = renderHook(() =>
      useConsumptionAnalytics({ itemId: 'item1' })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.itemCostSummary).toEqual(mockItemSummary);
    expect(result.current.consumptionRate).toEqual(mockConsumptionRate);
  });

  it('should handle errors gracefully', async () => {
    const mockError = new Error('Test error');

    // Mock all required functions since error in any will cause error state
    jest
      .spyOn(ConsumptionHistory, 'getConsumptionHistory')
      .mockRejectedValue(mockError);
    jest
      .spyOn(ConsumptionHistory, 'getConsumptionByCategory')
      .mockRejectedValue(mockError);

    const { result } = renderHook(() => useConsumptionAnalytics({}));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.error?.message).toContain('error');
  });
});
