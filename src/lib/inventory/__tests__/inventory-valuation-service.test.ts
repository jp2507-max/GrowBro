/**
 * Inventory Valuation Service Tests
 *
 * Tests for real-time inventory valuation calculations using FIFO costing.
 */

import { type Database } from '@nozbe/watermelondb';

import {
  calculateValuePercentage,
  formatValue,
  getCategoryValuations,
  getInventoryValuation,
  getItemValuation,
} from '../inventory-valuation-service';

// Mock WatermelonDB
jest.mock('@nozbe/watermelondb');

describe('InventoryValuationService', () => {
  let mockDatabase: jest.Mocked<Database>;

  beforeEach(() => {
    mockDatabase = {
      get: jest.fn(),
    } as any;
  });

  describe('formatValue', () => {
    it('should format value with default currency', () => {
      expect(formatValue(0)).toBe('$0.00');
      expect(formatValue(100)).toBe('$1.00');
      expect(formatValue(1050)).toBe('$10.50');
      expect(formatValue(999999)).toBe('$9999.99');
    });

    it('should format value with custom currency', () => {
      expect(formatValue(100, '€')).toBe('€1.00');
      expect(formatValue(2550, '£')).toBe('£25.50');
    });

    it('should handle negative values', () => {
      expect(formatValue(-100)).toBe('$-1.00');
    });
  });

  describe('calculateValuePercentage', () => {
    it('should calculate percentage correctly', () => {
      expect(calculateValuePercentage(5000, 10000)).toBe(50);
      expect(calculateValuePercentage(2500, 10000)).toBe(25);
      expect(calculateValuePercentage(7500, 10000)).toBe(75);
    });

    it('should handle zero total value', () => {
      expect(calculateValuePercentage(100, 0)).toBe(0);
    });

    it('should round to nearest integer', () => {
      expect(calculateValuePercentage(3333, 10000)).toBe(33);
      expect(calculateValuePercentage(6667, 10000)).toBe(67);
    });
  });

  describe('getItemValuation', () => {
    it('should calculate valuation for item with single batch', async () => {
      const mockItem = {
        id: 'item1',
        name: 'Test Nutrient',
        category: 'Nutrients',
      };

      const mockBatches = [
        {
          id: 'batch1',
          itemId: 'item1',
          quantity: 500,
          costPerUnitMinor: 150, // $1.50 per unit
        },
      ];

      const mockItemCollection = {
        find: jest.fn().mockResolvedValue(mockItem),
      };

      const mockBatchCollection = {
        query: jest.fn().mockReturnValue({
          fetch: jest.fn().mockResolvedValue(mockBatches),
        }),
      };

      mockDatabase.get = jest.fn().mockImplementation((tableName: string) => {
        if (tableName === 'inventory_items') return mockItemCollection;
        if (tableName === 'inventory_batches') return mockBatchCollection;
        return null;
      });

      const valuation = await getItemValuation(mockDatabase, 'item1');

      expect(valuation.itemId).toBe('item1');
      expect(valuation.itemName).toBe('Test Nutrient');
      expect(valuation.category).toBe('Nutrients');
      expect(valuation.totalQuantity).toBe(500);
      expect(valuation.totalValueMinor).toBe(75000); // 500 * 150
      expect(valuation.avgCostPerUnitMinor).toBe(150);
      expect(valuation.batchCount).toBe(1);
    });

    it('should calculate valuation for item with multiple batches (FIFO)', async () => {
      const mockItem = {
        id: 'item1',
        name: 'Mixed Cost Item',
        category: 'Seeds',
      };

      const mockBatches = [
        { quantity: 100, costPerUnitMinor: 200 }, // $2.00
        { quantity: 50, costPerUnitMinor: 300 }, // $3.00
      ];

      const mockItemCollection = {
        find: jest.fn().mockResolvedValue(mockItem),
      };

      const mockBatchCollection = {
        query: jest.fn().mockReturnValue({
          fetch: jest.fn().mockResolvedValue(mockBatches),
        }),
      };

      mockDatabase.get = jest.fn().mockImplementation((tableName: string) => {
        if (tableName === 'inventory_items') return mockItemCollection;
        if (tableName === 'inventory_batches') return mockBatchCollection;
        return null;
      });

      const valuation = await getItemValuation(mockDatabase, 'item1');

      expect(valuation.totalQuantity).toBe(150);
      expect(valuation.totalValueMinor).toBe(35000); // (100 * 200) + (50 * 300)
      expect(valuation.avgCostPerUnitMinor).toBe(233); // 35000 / 150, rounded
      expect(valuation.batchCount).toBe(2);
    });

    it('should handle zero-cost batches', async () => {
      const mockItem = {
        id: 'item1',
        name: 'Free Sample',
        category: 'Amendments',
      };

      const mockBatches = [{ quantity: 50, costPerUnitMinor: 0 }];

      const mockItemCollection = {
        find: jest.fn().mockResolvedValue(mockItem),
      };

      const mockBatchCollection = {
        query: jest.fn().mockReturnValue({
          fetch: jest.fn().mockResolvedValue(mockBatches),
        }),
      };

      mockDatabase.get = jest.fn().mockImplementation((tableName: string) => {
        if (tableName === 'inventory_items') return mockItemCollection;
        if (tableName === 'inventory_batches') return mockBatchCollection;
        return null;
      });

      const valuation = await getItemValuation(mockDatabase, 'item1');

      expect(valuation.totalQuantity).toBe(50);
      expect(valuation.totalValueMinor).toBe(0);
      expect(valuation.avgCostPerUnitMinor).toBe(0);
    });
  });

  describe('getCategoryValuations', () => {
    it('should aggregate valuations by category', async () => {
      const mockItems = [
        { id: 'item1', category: 'Nutrients' },
        { id: 'item2', category: 'Seeds' },
      ];

      const mockBatches = [
        { itemId: 'item1', quantity: 100, costPerUnitMinor: 100 }, // $100 total
        { itemId: 'item2', quantity: 20, costPerUnitMinor: 500 }, // $100 total
      ];

      const mockItemCollection = {
        query: jest.fn().mockReturnValue({
          fetch: jest.fn().mockResolvedValue(mockItems),
        }),
      };

      const mockBatchCollection = {
        query: jest.fn().mockReturnValue({
          fetch: jest.fn().mockResolvedValue(mockBatches),
        }),
      };

      mockDatabase.get = jest.fn().mockImplementation((tableName: string) => {
        if (tableName === 'inventory_items') return mockItemCollection;
        if (tableName === 'inventory_batches') return mockBatchCollection;
        return null;
      });

      const categories = await getCategoryValuations(mockDatabase);

      expect(categories).toHaveLength(2);
      // Should be sorted by value descending, but both have same value
      expect(categories[0].totalValueMinor).toBe(10000);
      expect(categories[1].totalValueMinor).toBe(10000);
    });

    it('should return empty array when no items exist', async () => {
      const mockItemCollection = {
        query: jest.fn().mockReturnValue({
          fetch: jest.fn().mockResolvedValue([]),
        }),
      };

      mockDatabase.get = jest.fn().mockReturnValue(mockItemCollection);

      const categories = await getCategoryValuations(mockDatabase);
      expect(categories).toEqual([]);
    });
  });

  describe('getInventoryValuation', () => {
    it('should calculate overall valuation with category breakdown', async () => {
      const mockItems = [
        { id: 'item1', category: 'Nutrients' },
        { id: 'item2', category: 'Seeds' },
      ];

      const mockBatches = [
        { itemId: 'item1', quantity: 100, costPerUnitMinor: 100 },
        { itemId: 'item2', quantity: 25, costPerUnitMinor: 400 },
      ];

      const mockItemCollection = {
        query: jest.fn().mockReturnValue({
          fetch: jest.fn().mockResolvedValue(mockItems),
        }),
      };

      const mockBatchCollection = {
        query: jest.fn().mockReturnValue({
          fetch: jest.fn().mockResolvedValue(mockBatches),
        }),
      };

      mockDatabase.get = jest.fn().mockImplementation((tableName: string) => {
        if (tableName === 'inventory_items') return mockItemCollection;
        if (tableName === 'inventory_batches') return mockBatchCollection;
        return null;
      });

      const valuation = await getInventoryValuation(mockDatabase);

      expect(valuation.totalValueMinor).toBe(20000); // (100 * 100) + (25 * 400)
      expect(valuation.itemCount).toBe(2);
      expect(valuation.batchCount).toBe(2);
      expect(valuation.categories).toHaveLength(2);
      expect(valuation.calculatedAt).toBeInstanceOf(Date);
    });
  });
});
