/**
 * Inventory Search Service Tests
 *
 * Tests for search accuracy, performance, and offline functionality.
 *
 * Requirements:
 * - 8.5: 150ms debounce and search performance <150ms
 * - 8.6: Offline search with cached index
 */

import { type Database } from '@nozbe/watermelondb';

import {
  getSearchService,
  InventorySearchService,
} from '@/lib/inventory/search-service';
import type {
  InventoryItemWithStock,
  InventorySearchQuery,
} from '@/types/inventory';

// Mock database
jest.mock('@nozbe/watermelondb');

describe('InventorySearchService', () => {
  let service: InventorySearchService;
  let mockDatabase: Database;
  let sampleItems: InventoryItemWithStock[];

  beforeEach(() => {
    mockDatabase = {} as Database;
    service = new InventorySearchService(mockDatabase);

    // Create sample items for testing
    sampleItems = [
      {
        id: '1',
        name: 'General Hydroponics FloraBloom',
        category: 'Nutrients',
        unitOfMeasure: 'L',
        trackingMode: 'batched',
        isConsumable: true,
        minStock: 2,
        reorderMultiple: 1,
        sku: 'GH-FB-1L',
        barcode: '123456789012',
        userId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        currentStock: 5,
        unitCost: 25.99,
        totalValue: 129.95,
        isLowStock: false,
      },
      {
        id: '2',
        name: 'Fox Farm Ocean Forest Soil',
        category: 'Growing Media',
        unitOfMeasure: 'bag',
        trackingMode: 'simple',
        isConsumable: true,
        minStock: 5,
        reorderMultiple: 3,
        sku: 'FF-OF-50L',
        userId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        currentStock: 3,
        unitCost: 19.99,
        totalValue: 59.97,
        isLowStock: true,
      },
      {
        id: '3',
        name: 'General Hydroponics FloraMicro',
        category: 'Nutrients',
        unitOfMeasure: 'L',
        trackingMode: 'batched',
        isConsumable: true,
        minStock: 2,
        reorderMultiple: 1,
        sku: 'GH-FM-1L',
        userId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        currentStock: 4,
        unitCost: 22.99,
        totalValue: 91.96,
        isLowStock: false,
      },
    ];
  });

  describe('buildSearchIndex', () => {
    it('should build search index from items', async () => {
      const index = await service.buildSearchIndex(sampleItems);

      expect(index.items.size).toBe(3);
      expect(index.tokens.size).toBeGreaterThan(0);
      expect(index.version).toBe(1);
    });

    it('should index item names, SKUs, and categories', async () => {
      const index = await service.buildSearchIndex(sampleItems);

      // Check that tokens exist for common search terms
      const tokens = Array.from(index.tokens.keys());
      expect(tokens).toContain('general');
      expect(tokens).toContain('hydroponics');
      expect(tokens).toContain('nutrients');
      expect(tokens).toContain('florabloom');
    });

    it('should normalize text and remove diacritics', async () => {
      const itemsWithDiacritics: InventoryItemWithStock[] = [
        {
          ...sampleItems[0],
          name: 'Café Organic Fertilizer',
        },
      ];

      const index = await service.buildSearchIndex(itemsWithDiacritics);
      const tokens = Array.from(index.tokens.keys());

      expect(tokens).toContain('cafe'); // Diacritics removed
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      await service.buildSearchIndex(sampleItems);
    });

    it('should find items by name', async () => {
      const query: InventorySearchQuery = {
        searchText: 'FloraBloom',
      };

      const result = await service.search(sampleItems, query);

      expect(result.items.length).toBe(1);
      expect(result.items[0].name).toContain('FloraBloom');
    });

    it('should find items by SKU', async () => {
      const query: InventorySearchQuery = {
        searchText: 'GH-FB-1L',
      };

      const result = await service.search(sampleItems, query);

      expect(result.items.length).toBe(1);
      expect(result.items[0].sku).toBe('GH-FB-1L');
    });

    it('should find items by category', async () => {
      const query: InventorySearchQuery = {
        searchText: 'Nutrients',
      };

      const result = await service.search(sampleItems, query);

      expect(result.items.length).toBe(2);
      expect(result.items.every((item) => item.category === 'Nutrients')).toBe(
        true
      );
    });

    it('should filter by category', async () => {
      const query: InventorySearchQuery = {
        searchText: '',
        filters: {
          category: 'Nutrients',
        },
      };

      const result = await service.search(sampleItems, query);

      expect(result.items.length).toBe(2);
      expect(result.items.every((item) => item.category === 'Nutrients')).toBe(
        true
      );
    });

    it('should filter by low stock', async () => {
      const query: InventorySearchQuery = {
        searchText: '',
        filters: {
          isLowStock: true,
        },
      };

      const result = await service.search(sampleItems, query);

      expect(result.items.length).toBe(1);
      expect(result.items[0].isLowStock).toBe(true);
    });

    it('should sort items by name', async () => {
      const query: InventorySearchQuery = {
        searchText: '',
        sort: {
          field: 'name',
          direction: 'asc',
        },
      };

      const result = await service.search(sampleItems, query);

      // Fox Farm comes first, then both General Hydroponics items
      expect(result.items[0].name).toContain('Fox Farm');
      expect(result.items[1].name).toContain('General Hydroponics');
      expect(result.items[2].name).toContain('General Hydroponics');
    });

    it('should sort items by stock level', async () => {
      const query: InventorySearchQuery = {
        searchText: '',
        sort: {
          field: 'currentStock',
          direction: 'asc',
        },
      };

      const result = await service.search(sampleItems, query);

      expect(result.items[0].currentStock).toBe(3);
      expect(result.items[1].currentStock).toBe(4);
      expect(result.items[2].currentStock).toBe(5);
    });

    it('should apply limit to results', async () => {
      const query: InventorySearchQuery = {
        searchText: '',
        limit: 2,
      };

      const result = await service.search(sampleItems, query);

      expect(result.items.length).toBe(2);
    });

    it('should calculate facets', async () => {
      const query: InventorySearchQuery = {
        searchText: '',
      };

      const result = await service.search(sampleItems, query);

      expect(result.facets.categories.length).toBeGreaterThan(0);
      expect(result.facets.totalCount).toBe(3);
      expect(result.facets.lowStockCount).toBe(1);
    });

    it('should complete search in <150ms', async () => {
      const query: InventorySearchQuery = {
        searchText: 'General',
      };

      const startTime = Date.now();
      const result = await service.search(sampleItems, query);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(150);
      expect(result.executionTimeMs).toBeLessThan(150);
    });

    it('should perform case-insensitive search', async () => {
      const query: InventorySearchQuery = {
        searchText: 'FLORABLOOM',
      };

      const result = await service.search(sampleItems, query);

      expect(result.items.length).toBe(1);
      expect(result.items[0].name).toContain('FloraBloom');
    });

    it('should handle partial word matches', async () => {
      const query: InventorySearchQuery = {
        searchText: 'Flora',
      };

      const result = await service.search(sampleItems, query);

      expect(result.items.length).toBe(2);
      expect(result.items.every((item) => item.name.includes('Flora'))).toBe(
        true
      );
    });
  });

  describe('searchOffline', () => {
    it('should return null if index not built', async () => {
      const query: InventorySearchQuery = {
        searchText: 'test',
      };

      const result = await service.searchOffline(query);

      expect(result).toBeNull();
    });

    it('should search from cached index', async () => {
      await service.buildSearchIndex(sampleItems);

      const query: InventorySearchQuery = {
        searchText: 'FloraBloom',
      };

      const result = await service.searchOffline(query);

      expect(result).not.toBeNull();
      expect(result!.isOffline).toBe(true);
      expect(result!.items.length).toBe(1);
    });
  });

  describe('getCacheStats', () => {
    it('should return null if no cache', () => {
      const stats = service.getCacheStats();

      expect(stats).toBeNull();
    });

    it('should return cache statistics', async () => {
      await service.buildSearchIndex(sampleItems);

      const stats = service.getCacheStats();

      expect(stats).not.toBeNull();
      expect(stats!.itemCount).toBe(3);
      expect(stats!.tokenCount).toBeGreaterThan(0);
      expect(stats!.lastUpdated).toBeInstanceOf(Date);
    });
  });

  describe('getSearchService singleton', () => {
    it('should return same instance', () => {
      const service1 = getSearchService(mockDatabase);
      const service2 = getSearchService(mockDatabase);

      expect(service1).toBe(service2);
    });
  });
});
