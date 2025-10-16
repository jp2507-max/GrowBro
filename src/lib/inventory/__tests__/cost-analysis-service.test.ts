/**
 * Cost Analysis Service Tests
 *
 * Unit tests for cost calculation and aggregation utilities.
 * Tests FIFO cost integrity, split consumption, and minor currency handling.
 *
 * Requirements: 9.3, 9.4
 */

import { type Database } from '@nozbe/watermelondb';

import {
  formatCost,
  getCategoryCostSummaries,
  getHarvestCostSummary,
  getItemCostSummary,
  getTimeSerieCostData,
} from '../cost-analysis-service';

// Mock WatermelonDB
jest.mock('@nozbe/watermelondb');

describe('Cost Analysis Service', () => {
  let mockDatabase: jest.Mocked<Database>;

  beforeEach(() => {
    mockDatabase = {
      get: jest.fn(),
    } as any;
  });

  describe('formatCost', () => {
    it('should format cost from minor units to display string', () => {
      expect(formatCost(10050)).toBe('$100.50');
      expect(formatCost(99)).toBe('$0.99');
      expect(formatCost(0)).toBe('$0.00');
      expect(formatCost(1)).toBe('$0.01');
    });

    it('should support custom currency symbols', () => {
      expect(formatCost(10050, '€')).toBe('€100.50');
      expect(formatCost(10050, '£')).toBe('£100.50');
    });
  });

  describe('getItemCostSummary', () => {
    it('should calculate cost summary for an item', async () => {
      const mockMovements = [
        {
          id: 'mov1',
          itemId: 'item1',
          quantityDelta: -10,
          costPerUnitMinor: 100,
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'mov2',
          itemId: 'item1',
          quantityDelta: -5,
          costPerUnitMinor: 120,
          createdAt: new Date('2024-01-02'),
        },
      ];

      const mockItem = {
        id: 'item1',
        name: 'Test Item',
      };

      mockDatabase.get.mockImplementation((tableName: string) => {
        if (tableName === 'inventory_movements') {
          return {
            query: jest.fn().mockReturnValue({
              fetch: jest.fn().mockResolvedValue(mockMovements),
            }),
          } as any;
        }
        if (tableName === 'inventory_items') {
          return {
            find: jest.fn().mockResolvedValue(mockItem),
          } as any;
        }
        return {} as any;
      });

      const summary = await getItemCostSummary(mockDatabase, 'item1');

      expect(summary).toEqual({
        itemId: 'item1',
        itemName: 'Test Item',
        totalQuantity: 15, // 10 + 5
        totalCostMinor: 1600, // (10 * 100) + (5 * 120)
        avgCostPerUnitMinor: 107, // Math.round(1600 / 15)
        movementCount: 2,
      });
    });

    it('should handle zero-cost items', async () => {
      const mockMovements = [
        {
          id: 'mov1',
          itemId: 'item1',
          quantityDelta: -10,
          costPerUnitMinor: 0,
          createdAt: new Date('2024-01-01'),
        },
      ];

      const mockItem = {
        id: 'item1',
        name: 'Free Item',
      };

      mockDatabase.get.mockImplementation((tableName: string) => {
        if (tableName === 'inventory_movements') {
          return {
            query: jest.fn().mockReturnValue({
              fetch: jest.fn().mockResolvedValue(mockMovements),
            }),
          } as any;
        }
        if (tableName === 'inventory_items') {
          return {
            find: jest.fn().mockResolvedValue(mockItem),
          } as any;
        }
        return {} as any;
      });

      const summary = await getItemCostSummary(mockDatabase, 'item1');

      expect(summary.totalCostMinor).toBe(0);
      expect(summary.avgCostPerUnitMinor).toBe(0);
    });

    it('should handle split consumption across batches with different costs', async () => {
      const mockMovements = [
        {
          id: 'mov1',
          itemId: 'item1',
          quantityDelta: -3,
          costPerUnitMinor: 100, // Batch 1: $1.00/unit
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'mov2',
          itemId: 'item1',
          quantityDelta: -2,
          costPerUnitMinor: 150, // Batch 2: $1.50/unit (FIFO)
          createdAt: new Date('2024-01-01'),
        },
      ];

      const mockItem = {
        id: 'item1',
        name: 'Split Item',
      };

      mockDatabase.get.mockImplementation((tableName: string) => {
        if (tableName === 'inventory_movements') {
          return {
            query: jest.fn().mockReturnValue({
              fetch: jest.fn().mockResolvedValue(mockMovements),
            }),
          } as any;
        }
        if (tableName === 'inventory_items') {
          return {
            find: jest.fn().mockResolvedValue(mockItem),
          } as any;
        }
        return {} as any;
      });

      const summary = await getItemCostSummary(mockDatabase, 'item1');

      // Verify FIFO cost integrity: each movement preserves batch cost
      expect(summary.totalQuantity).toBe(5); // 3 + 2
      expect(summary.totalCostMinor).toBe(600); // (3 * 100) + (2 * 150)
      expect(summary.avgCostPerUnitMinor).toBe(120); // Math.round(600 / 5)
    });
  });

  describe('getCategoryCostSummaries', () => {
    it('should aggregate costs by category', async () => {
      const mockMovements = [
        {
          id: 'mov1',
          itemId: 'item1',
          quantityDelta: -10,
          costPerUnitMinor: 100,
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'mov2',
          itemId: 'item2',
          quantityDelta: -5,
          costPerUnitMinor: 200,
          createdAt: new Date('2024-01-02'),
        },
        {
          id: 'mov3',
          itemId: 'item3',
          quantityDelta: -8,
          costPerUnitMinor: 50,
          createdAt: new Date('2024-01-03'),
        },
      ];

      const mockItems = [
        { id: 'item1', category: 'Nutrients' },
        { id: 'item2', category: 'Nutrients' },
        { id: 'item3', category: 'Tools' },
      ];

      mockDatabase.get.mockImplementation((tableName: string) => {
        if (tableName === 'inventory_movements') {
          return {
            query: jest.fn().mockReturnValue({
              fetch: jest.fn().mockResolvedValue(mockMovements),
            }),
          } as any;
        }
        if (tableName === 'inventory_items') {
          return {
            query: jest.fn().mockReturnValue({
              fetch: jest.fn().mockResolvedValue(mockItems),
            }),
          } as any;
        }
        return {} as any;
      });

      const summaries = await getCategoryCostSummaries(mockDatabase);

      expect(summaries).toHaveLength(2);

      const nutrientsSummary = summaries.find(
        (s) => s.category === 'Nutrients'
      );
      expect(nutrientsSummary).toEqual({
        category: 'Nutrients',
        totalQuantity: 15, // 10 + 5
        totalCostMinor: 2000, // (10 * 100) + (5 * 200)
        itemCount: 2, // item1, item2
        movementCount: 2,
      });

      const toolsSummary = summaries.find((s) => s.category === 'Tools');
      expect(toolsSummary).toEqual({
        category: 'Tools',
        totalQuantity: 8,
        totalCostMinor: 400, // 8 * 50
        itemCount: 1, // item3
        movementCount: 1,
      });
    });

    it('should return empty array when no movements exist', async () => {
      mockDatabase.get.mockImplementation((tableName: string) => {
        if (tableName === 'inventory_movements') {
          return {
            query: jest.fn().mockReturnValue({
              fetch: jest.fn().mockResolvedValue([]),
            }),
          } as any;
        }
        return {} as any;
      });

      const summaries = await getCategoryCostSummaries(mockDatabase);

      expect(summaries).toEqual([]);
    });
  });

  describe('getHarvestCostSummary', () => {
    it('should calculate total cost for harvest task', async () => {
      const mockMovements = [
        {
          id: 'mov1',
          itemId: 'item1',
          taskId: 'task1',
          quantityDelta: -10,
          costPerUnitMinor: 100,
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'mov2',
          itemId: 'item2',
          taskId: 'task1',
          quantityDelta: -5,
          costPerUnitMinor: 200,
          createdAt: new Date('2024-01-01'),
        },
      ];

      const mockItems = [
        { id: 'item1', name: 'Jar' },
        { id: 'item2', name: 'Label' },
      ];

      mockDatabase.get.mockImplementation((tableName: string) => {
        if (tableName === 'inventory_movements') {
          return {
            query: jest.fn().mockReturnValue({
              fetch: jest.fn().mockResolvedValue(mockMovements),
            }),
          } as any;
        }
        if (tableName === 'inventory_items') {
          return {
            query: jest.fn().mockReturnValue({
              fetch: jest.fn().mockResolvedValue(mockItems),
            }),
          } as any;
        }
        return {} as any;
      });

      const summary = await getHarvestCostSummary(mockDatabase, 'task1');

      expect(summary).toEqual({
        taskId: 'task1',
        totalCostMinor: 2000, // (10 * 100) + (5 * 200)
        items: [
          {
            itemId: 'item1',
            itemName: 'Jar',
            quantity: 10,
            costMinor: 1000,
          },
          {
            itemId: 'item2',
            itemName: 'Label',
            quantity: 5,
            costMinor: 1000,
          },
        ],
        movementCount: 2,
      });
    });

    it('should handle task with no consumptions', async () => {
      mockDatabase.get.mockImplementation((tableName: string) => {
        if (tableName === 'inventory_movements') {
          return {
            query: jest.fn().mockReturnValue({
              fetch: jest.fn().mockResolvedValue([]),
            }),
          } as any;
        }
        return {} as any;
      });

      const summary = await getHarvestCostSummary(mockDatabase, 'task-empty');

      expect(summary).toEqual({
        taskId: 'task-empty',
        totalCostMinor: 0,
        items: [],
        movementCount: 0,
      });
    });
  });

  describe('getTimeSerieCostData', () => {
    it('should aggregate costs by week and category', async () => {
      const mockMovements = [
        {
          id: 'mov1',
          itemId: 'item1',
          quantityDelta: -10,
          costPerUnitMinor: 100,
          createdAt: new Date('2024-01-08'), // Week 2
        },
        {
          id: 'mov2',
          itemId: 'item1',
          quantityDelta: -5,
          costPerUnitMinor: 100,
          createdAt: new Date('2024-01-15'), // Week 3
        },
      ];

      const mockItems = [{ id: 'item1', category: 'Nutrients' }];

      mockDatabase.get.mockImplementation((tableName: string) => {
        if (tableName === 'inventory_movements') {
          return {
            query: jest.fn().mockReturnValue({
              fetch: jest.fn().mockResolvedValue(mockMovements),
            }),
          } as any;
        }
        if (tableName === 'inventory_items') {
          return {
            query: jest.fn().mockReturnValue({
              fetch: jest.fn().mockResolvedValue(mockItems),
            }),
          } as any;
        }
        return {} as any;
      });

      const result = await getTimeSerieCostData(mockDatabase, {
        bucketType: 'week',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      });

      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('Nutrients');
      expect(result[0].dataPoints).toHaveLength(2);
      expect(result[0].dataPoints[0].costMinor).toBe(1000); // 10 * 100
      expect(result[0].dataPoints[1].costMinor).toBe(500); // 5 * 100
    });
  });
});
