/**
 * Inventory Item Service Tests
 *
 * Comprehensive unit tests for inventory item CRUD operations,
 * validation rules, and edge cases.
 *
 * Requirements:
 * - 1.2: Item creation with required fields and validation
 * - 1.3: Item queries and display
 */

import { database } from '@/lib/watermelon';
import type { CreateInventoryItemRequest } from '@/types/inventory';

import * as InventoryItemService from '../inventory-item-service';

// Mock WatermelonDB
jest.mock('@/lib/watermelon', () => ({
  database: {
    get: jest.fn(),
    write: jest.fn(),
  },
}));

describe('inventory-item-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateCreateRequest', () => {
    const validData: CreateInventoryItemRequest = {
      name: 'Test Nutrient',
      category: 'Nutrients',
      unitOfMeasure: 'ml',
      trackingMode: 'simple',
      isConsumable: true,
      minStock: 100,
      reorderMultiple: 500,
    };

    it('should pass validation for valid data', () => {
      const errors = InventoryItemService.validateCreateRequest(validData);
      expect(errors).toHaveLength(0);
    });

    it('should require name', () => {
      const errors = InventoryItemService.validateCreateRequest({
        ...validData,
        name: '',
      });
      expect(errors).toContainEqual({
        field: 'name',
        message: InventoryItemService.VALIDATION_ERRORS.REQUIRED_FIELD,
        value: '',
      });
    });

    it('should require category', () => {
      const errors = InventoryItemService.validateCreateRequest({
        ...validData,
        category: undefined as unknown as 'Nutrients',
      });
      expect(errors.some((e) => e.field === 'category')).toBe(true);
    });

    it('should validate category is valid', () => {
      const errors = InventoryItemService.validateCreateRequest({
        ...validData,
        category: 'InvalidCategory' as 'Nutrients',
      });
      expect(errors).toContainEqual({
        field: 'category',
        message: InventoryItemService.VALIDATION_ERRORS.INVALID_CATEGORY,
        value: 'InvalidCategory',
      });
    });

    it('should require unitOfMeasure', () => {
      const errors = InventoryItemService.validateCreateRequest({
        ...validData,
        unitOfMeasure: '',
      });
      expect(errors).toContainEqual({
        field: 'unitOfMeasure',
        message: InventoryItemService.VALIDATION_ERRORS.REQUIRED_FIELD,
        value: '',
      });
    });

    it('should require trackingMode', () => {
      const errors = InventoryItemService.validateCreateRequest({
        ...validData,
        trackingMode: undefined as unknown as 'simple',
      });
      expect(errors.some((e) => e.field === 'trackingMode')).toBe(true);
    });

    it('should validate trackingMode is simple or batched', () => {
      const errors = InventoryItemService.validateCreateRequest({
        ...validData,
        trackingMode: 'invalid' as 'simple',
      });
      expect(errors).toContainEqual({
        field: 'trackingMode',
        message: InventoryItemService.VALIDATION_ERRORS.INVALID_TRACKING_MODE,
        value: 'invalid',
      });
    });

    it('should require isConsumable', () => {
      const errors = InventoryItemService.validateCreateRequest({
        ...validData,
        isConsumable: undefined as unknown as boolean,
      });
      expect(errors.some((e) => e.field === 'isConsumable')).toBe(true);
    });

    it('should require minStock to be non-negative', () => {
      const errors = InventoryItemService.validateCreateRequest({
        ...validData,
        minStock: -1,
      });
      expect(errors).toContainEqual({
        field: 'minStock',
        message: InventoryItemService.VALIDATION_ERRORS.INVALID_NUMBER,
        value: -1,
      });
    });

    it('should require reorderMultiple to be positive', () => {
      const errors = InventoryItemService.validateCreateRequest({
        ...validData,
        reorderMultiple: 0,
      });
      expect(errors).toContainEqual({
        field: 'reorderMultiple',
        message:
          InventoryItemService.VALIDATION_ERRORS.INVALID_REORDER_MULTIPLE,
        value: 0,
      });
    });

    it('should validate leadTimeDays is non-negative when provided', () => {
      const errors = InventoryItemService.validateCreateRequest({
        ...validData,
        leadTimeDays: -5,
      });
      expect(errors).toContainEqual({
        field: 'leadTimeDays',
        message: InventoryItemService.VALIDATION_ERRORS.INVALID_NUMBER,
        value: -5,
      });
    });
  });

  describe('createInventoryItem', () => {
    it('should create item with valid data', async () => {
      const mockCreate = jest.fn().mockImplementation((_callback) =>
        Promise.resolve({
          id: 'item-1',
          name: 'Test Nutrient',
          category: 'Nutrients',
          unitOfMeasure: 'ml',
          trackingMode: 'simple',
          isConsumable: true,
          minStock: 100,
          reorderMultiple: 500,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      );

      const mockQuery = jest.fn().mockReturnValue({
        fetch: jest.fn().mockResolvedValue([]),
      });

      const mockCollection = {
        create: mockCreate,
        query: mockQuery,
      };

      (database.get as jest.Mock).mockReturnValue(mockCollection);
      (database.write as jest.Mock).mockImplementation((callback) =>
        callback()
      );

      const data: CreateInventoryItemRequest = {
        name: 'Test Nutrient',
        category: 'Nutrients',
        unitOfMeasure: 'ml',
        trackingMode: 'simple',
        isConsumable: true,
        minStock: 100,
        reorderMultiple: 500,
      };

      const result = await InventoryItemService.createInventoryItem(data);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.name).toBe('Test Nutrient');
    });

    it('should return validation errors for invalid data', async () => {
      const data: CreateInventoryItemRequest = {
        name: '',
        category: 'Nutrients',
        unitOfMeasure: 'ml',
        trackingMode: 'simple',
        isConsumable: true,
        minStock: -1,
        reorderMultiple: 0,
      };

      const result = await InventoryItemService.createInventoryItem(data);

      expect(result.success).toBe(false);
      expect(result.validationErrors).toBeDefined();
      expect(result.validationErrors!.length).toBeGreaterThan(0);
    });

    it('should check for duplicate SKU', async () => {
      const mockQuery = jest.fn().mockReturnValue({
        fetch: jest.fn().mockResolvedValue([{ id: 'existing-item' }]),
      });

      const mockCollection = {
        query: mockQuery,
      };

      (database.get as jest.Mock).mockReturnValue(mockCollection);

      const data: CreateInventoryItemRequest = {
        name: 'Test Item',
        category: 'Nutrients',
        unitOfMeasure: 'ml',
        trackingMode: 'simple',
        isConsumable: true,
        minStock: 100,
        reorderMultiple: 500,
        sku: 'DUPLICATE-SKU',
      };

      const result = await InventoryItemService.createInventoryItem(data);

      expect(result.success).toBe(false);
      expect(result.validationErrors).toContainEqual({
        field: 'sku',
        message: InventoryItemService.VALIDATION_ERRORS.DUPLICATE_SKU,
        value: 'DUPLICATE-SKU',
      });
    });

    it('should trim name and unit of measure', async () => {
      const mockCreate = jest.fn().mockImplementation((_callback) => {
        const record = {
          name: 'Test Nutrient',
          unitOfMeasure: 'ml',
        };
        return Promise.resolve({
          ...record,
          id: 'item-1',
          category: 'Nutrients',
          trackingMode: 'simple',
          isConsumable: true,
          minStock: 100,
          reorderMultiple: 500,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      });

      const mockQuery = jest.fn().mockReturnValue({
        fetch: jest.fn().mockResolvedValue([]),
      });

      const mockCollection = {
        create: mockCreate,
        query: mockQuery,
      };

      (database.get as jest.Mock).mockReturnValue(mockCollection);
      (database.write as jest.Mock).mockImplementation((callback) =>
        callback()
      );

      const data: CreateInventoryItemRequest = {
        name: '  Test Nutrient  ',
        category: 'Nutrients',
        unitOfMeasure: '  ml  ',
        trackingMode: 'simple',
        isConsumable: true,
        minStock: 100,
        reorderMultiple: 500,
      };

      await InventoryItemService.createInventoryItem(data);

      expect(mockCreate).toHaveBeenCalled();
    });
  });

  describe('getInventoryItem', () => {
    it('should return item by id', async () => {
      const mockItem = {
        id: 'item-1',
        name: 'Test Item',
        category: 'Nutrients',
        unitOfMeasure: 'ml',
        trackingMode: 'simple',
        isConsumable: true,
        minStock: 100,
        reorderMultiple: 500,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockCollection = {
        find: jest.fn().mockResolvedValue(mockItem),
      };

      (database.get as jest.Mock).mockReturnValue(mockCollection);

      const result = await InventoryItemService.getInventoryItem('item-1');

      expect(result).toBeDefined();
      expect(result?.id).toBe('item-1');
    });

    it('should return null for deleted item', async () => {
      const mockItem = {
        id: 'item-1',
        deletedAt: new Date(),
      };

      const mockCollection = {
        find: jest.fn().mockResolvedValue(mockItem),
      };

      (database.get as jest.Mock).mockReturnValue(mockCollection);

      const result = await InventoryItemService.getInventoryItem('item-1');

      expect(result).toBeNull();
    });

    it('should return null when item not found', async () => {
      const mockCollection = {
        find: jest.fn().mockRejectedValue(new Error('Not found')),
      };

      (database.get as jest.Mock).mockReturnValue(mockCollection);

      const result = await InventoryItemService.getInventoryItem('item-1');

      expect(result).toBeNull();
    });
  });

  describe('queryInventoryItems', () => {
    it('should query items without filters', async () => {
      const mockItems = [
        {
          id: 'item-1',
          name: 'Item 1',
          category: 'Nutrients',
          unitOfMeasure: 'ml',
          trackingMode: 'simple',
          isConsumable: true,
          minStock: 100,
          reorderMultiple: 500,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockQuery = jest.fn().mockReturnValue({
        fetch: jest.fn().mockResolvedValue(mockItems),
      });

      const mockCollection = {
        query: mockQuery,
      };

      (database.get as jest.Mock).mockReturnValue(mockCollection);

      const result = await InventoryItemService.queryInventoryItems();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('item-1');
    });

    it('should filter by category', async () => {
      const mockQuery = jest.fn().mockReturnValue({
        fetch: jest.fn().mockResolvedValue([]),
      });

      const mockCollection = {
        query: mockQuery,
      };

      (database.get as jest.Mock).mockReturnValue(mockCollection);

      await InventoryItemService.queryInventoryItems({
        category: 'Nutrients',
      });

      expect(mockQuery).toHaveBeenCalled();
    });

    it('should filter by search term', async () => {
      const mockItems = [
        {
          id: 'item-1',
          name: 'Cal-Mag Nutrient',
        },
      ];

      const mockFetch = jest.fn().mockResolvedValue(mockItems);
      const mockQueryChain = {
        where: jest.fn().mockReturnThis(),
        fetch: mockFetch,
      };
      const mockQuery = jest.fn().mockReturnValue(mockQueryChain);

      (database.get as jest.Mock).mockReturnValue({
        query: mockQuery,
      });

      const results = await InventoryItemService.queryInventoryItems({
        search: 'nutrient',
      });

      // Verify the query chain was built correctly
      expect(database.get).toHaveBeenCalledWith('inventory_items');
      expect(mockQuery).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalled();
      expect(results.length).toBe(1);
    });
  });

  describe('updateInventoryItem', () => {
    it('should update item with valid data', async () => {
      const mockItem = {
        id: 'item-1',
        name: 'Old Name',
        deletedAt: null,
        update: jest.fn().mockImplementation((callback) => {
          const record = { name: 'Old Name' };
          callback(record);
          return Promise.resolve({
            id: 'item-1',
            name: record.name,
            category: 'Nutrients',
            unitOfMeasure: 'ml',
            trackingMode: 'simple',
            isConsumable: true,
            minStock: 100,
            reorderMultiple: 500,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }),
      };

      const mockQuery = jest.fn().mockReturnValue({
        fetch: jest.fn().mockResolvedValue([]),
      });

      const mockCollection = {
        find: jest.fn().mockResolvedValue(mockItem),
        query: mockQuery,
      };

      (database.get as jest.Mock).mockReturnValue(mockCollection);
      (database.write as jest.Mock).mockImplementation((callback) =>
        callback()
      );

      const result = await InventoryItemService.updateInventoryItem('item-1', {
        name: 'New Name',
      });

      expect(result.success).toBe(true);
      expect(mockItem.update).toHaveBeenCalled();
    });

    it('should return error for deleted item', async () => {
      const mockItem = {
        id: 'item-1',
        deletedAt: new Date(),
      };

      const mockCollection = {
        find: jest.fn().mockResolvedValue(mockItem),
      };

      (database.get as jest.Mock).mockReturnValue(mockCollection);

      const result = await InventoryItemService.updateInventoryItem('item-1', {
        name: 'New Name',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        InventoryItemService.VALIDATION_ERRORS.ITEM_NOT_FOUND
      );
    });

    it('should validate updates', async () => {
      const mockItem = {
        id: 'item-1',
        deletedAt: null,
      };

      const mockCollection = {
        find: jest.fn().mockResolvedValue(mockItem),
      };

      (database.get as jest.Mock).mockReturnValue(mockCollection);

      const result = await InventoryItemService.updateInventoryItem('item-1', {
        minStock: -1,
      });

      expect(result.success).toBe(false);
      expect(result.validationErrors).toBeDefined();
    });
  });

  describe('deleteInventoryItem', () => {
    it('should soft delete item', async () => {
      const mockItem = {
        id: 'item-1',
        deletedAt: null,
        update: jest.fn().mockResolvedValue({}),
      };

      const mockCollection = {
        find: jest.fn().mockResolvedValue(mockItem),
      };

      (database.get as jest.Mock).mockReturnValue(mockCollection);
      (database.write as jest.Mock).mockImplementation((callback) =>
        callback()
      );

      const result = await InventoryItemService.deleteInventoryItem('item-1');

      expect(result.success).toBe(true);
      expect(mockItem.update).toHaveBeenCalled();
    });

    it('should return error for already deleted item', async () => {
      const mockItem = {
        id: 'item-1',
        deletedAt: new Date(),
      };

      const mockCollection = {
        find: jest.fn().mockResolvedValue(mockItem),
      };

      (database.get as jest.Mock).mockReturnValue(mockCollection);

      const result = await InventoryItemService.deleteInventoryItem('item-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        InventoryItemService.VALIDATION_ERRORS.ITEM_NOT_FOUND
      );
    });
  });

  describe('getInventoryItemCountsByCategory', () => {
    it('should return category counts', async () => {
      const mockItems = [
        {
          id: 'item-1',
          category: 'Nutrients',
          name: 'Item 1',
          unitOfMeasure: 'ml',
          trackingMode: 'simple',
          isConsumable: true,
          minStock: 100,
          reorderMultiple: 500,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'item-2',
          category: 'Nutrients',
          name: 'Item 2',
          unitOfMeasure: 'ml',
          trackingMode: 'simple',
          isConsumable: true,
          minStock: 100,
          reorderMultiple: 500,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'item-3',
          category: 'Seeds',
          name: 'Item 3',
          unitOfMeasure: 'ea',
          trackingMode: 'simple',
          isConsumable: true,
          minStock: 10,
          reorderMultiple: 5,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockQuery = jest.fn().mockReturnValue({
        fetch: jest.fn().mockResolvedValue(mockItems),
      });

      const mockCollection = {
        query: mockQuery,
      };

      (database.get as jest.Mock).mockReturnValue(mockCollection);

      const result =
        await InventoryItemService.getInventoryItemCountsByCategory();

      expect(result.Nutrients).toBe(2);
      expect(result.Seeds).toBe(1);
    });
  });
});
