/**
 * Inventory Service Tests
 *
 * Tests atomic inventory creation with idempotency support.
 *
 * Requirements:
 * - 3.1, 3.2, 3.3: Atomic inventory creation
 * - 10.1, 10.2, 10.3, 10.4, 10.5: Idempotency and retry logic
 */

import { randomUUID } from 'expo-crypto';

import { HarvestStages } from '@/types';

import { supabase } from '../supabase';
import { database } from '../watermelon';
import type { HarvestModel } from '../watermelon-models/harvest';
import type { InventoryModel } from '../watermelon-models/inventory';
import * as InventoryService from './inventory-service';

// Mock dependencies
jest.mock('expo-crypto');
jest.mock('../supabase');
jest.mock('../watermelon');
jest.mock('../error-handling', () => ({
  categorizeError: jest.fn((error: any) => {
    // Default: not retryable
    let isRetryable = false;

    // Check for network errors or 5xx
    if (
      error?.message?.includes('Network') ||
      error?.message?.includes('Connection timeout') ||
      (error?.response?.status >= 500 && error?.response?.status < 600)
    ) {
      isRetryable = true;
    }

    return { isRetryable };
  }),
}));
jest.mock('../sync/backoff', () => ({
  computeBackoffMs: jest.fn((attempt: number) => attempt * 1000),
}));

const mockRandomUUID = randomUUID as jest.MockedFunction<typeof randomUUID>;

describe('InventoryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRandomUUID.mockReturnValue('test-uuid-1234');
  });

  describe('completeCuring', () => {
    const mockHarvestId = 'harvest-123';
    const mockFinalWeightG = 50000; // 50kg in grams

    describe('validation', () => {
      it('should reject if dry weight is missing', async () => {
        const result = await InventoryService.completeCuring({
          harvestId: mockHarvestId,
          finalWeightG: 0,
        });

        expect(result.success).toBe(false);
        expect(result.errorCode).toBe('MISSING_DRY_WEIGHT');
        expect(result.error).toContain('Dry weight must be set');
      });

      it('should reject if dry weight is negative', async () => {
        const result = await InventoryService.completeCuring({
          harvestId: mockHarvestId,
          finalWeightG: -100,
        });

        expect(result.success).toBe(false);
        expect(result.errorCode).toBe('MISSING_DRY_WEIGHT');
      });

      it('should reject if dry weight exceeds maximum', async () => {
        // Mock harvest fetch to return valid harvest
        const mockHarvest = {
          plantId: 'plant-1',
          wetWeightG: 200000,
        } as HarvestModel;

        const mockFind = jest.fn().mockResolvedValue(mockHarvest);
        (database.get as jest.Mock).mockReturnValue({
          find: mockFind,
        });

        const result = await InventoryService.completeCuring({
          harvestId: mockHarvestId,
          finalWeightG: 150000, // 150kg, exceeds 100kg limit
        });

        expect(result.success).toBe(false);
        expect(result.errorCode).toBe('VALIDATION');
      });

      it('should reject if dry weight exceeds wet weight', async () => {
        const mockHarvest = {
          plantId: 'plant-1',
          wetWeightG: 40000, // 40kg
        } as HarvestModel;

        const mockFind = jest.fn().mockResolvedValue(mockHarvest);
        (database.get as jest.Mock).mockReturnValue({
          find: mockFind,
        });

        const result = await InventoryService.completeCuring({
          harvestId: mockHarvestId,
          finalWeightG: 50000, // 50kg, exceeds wet weight
        });

        expect(result.success).toBe(false);
        expect(result.errorCode).toBe('VALIDATION');
      });
    });

    describe('idempotency', () => {
      it('should generate UUID if idempotency key not provided', async () => {
        // Mock harvest validation
        const mockHarvest = {
          plantId: 'plant-1',
          wetWeightG: 100000,
        } as HarvestModel;

        (database.get as jest.Mock).mockReturnValue({
          find: jest.fn().mockResolvedValue(mockHarvest),
        });

        // Mock Supabase RPC to fail gracefully (we're testing key generation only)
        supabase.rpc = jest.fn().mockResolvedValue({
          data: null,
          error: new Error('Network error'),
        });

        await InventoryService.completeCuring({
          harvestId: mockHarvestId,
          finalWeightG: mockFinalWeightG,
        });

        expect(mockRandomUUID).toHaveBeenCalled();
        expect(supabase.rpc).toHaveBeenCalledWith(
          'complete_curing_and_create_inventory',
          expect.objectContaining({
            p_idempotency_key: 'test-uuid-1234',
          })
        );
      });

      it('should use provided idempotency key', async () => {
        const customKey = 'custom-key-5678';
        const mockHarvest = {
          plantId: 'plant-1',
          wetWeightG: 100000,
        } as HarvestModel;

        (database.get as jest.Mock).mockReturnValue({
          find: jest.fn().mockResolvedValue(mockHarvest),
        });

        supabase.rpc = jest.fn().mockResolvedValue({
          data: null,
          error: new Error('Network error'),
        });

        await InventoryService.completeCuring({
          harvestId: mockHarvestId,
          finalWeightG: mockFinalWeightG,
          idempotencyKey: customKey,
        });

        expect(mockRandomUUID).not.toHaveBeenCalled();
        expect(supabase.rpc).toHaveBeenCalledWith(
          'complete_curing_and_create_inventory',
          expect.objectContaining({
            p_idempotency_key: customKey,
          })
        );
      });
    });

    describe('atomic operation', () => {
      it('should call RPC with correct parameters', async () => {
        const mockHarvest = {
          plantId: 'plant-1',
          wetWeightG: 100000,
        } as HarvestModel;

        (database.get as jest.Mock).mockReturnValue({
          find: jest.fn().mockResolvedValue(mockHarvest),
        });

        const mockResponse = {
          harvest_id: mockHarvestId,
          inventory_id: 'inventory-456',
          server_timestamp_ms: Date.now(),
        };
        supabase.rpc = jest.fn().mockResolvedValue({
          data: mockResponse,
          error: null,
        });

        // Mock database write
        const mockUpdate = jest.fn().mockImplementation((fn) => {
          fn({
            stage: HarvestStages.HARVEST,
            stageCompletedAt: null,
            serverUpdatedAtMs: 0,
          });
          return Promise.resolve({});
        });
        const mockCreate = jest.fn().mockResolvedValue({});
        const mockWrite = jest.fn().mockImplementation(async (fn) => fn());

        (database.get as jest.Mock).mockImplementation((table: string) => {
          if (table === 'harvests') {
            return {
              find: jest.fn().mockResolvedValue({
                plantId: 'plant-1',
                userId: 'user-1',
                dryWeightG: mockFinalWeightG,
                stageStartedAt: new Date('2025-01-01'),
                update: mockUpdate,
              }),
            };
          }
          return { create: mockCreate };
        });

        (database as any).write = mockWrite;

        await InventoryService.completeCuring({
          harvestId: mockHarvestId,
          finalWeightG: mockFinalWeightG,
          notes: 'Test notes',
        });

        expect(supabase.rpc).toHaveBeenCalledWith(
          'complete_curing_and_create_inventory',
          {
            p_harvest_id: mockHarvestId,
            p_final_weight_g: mockFinalWeightG,
            p_notes: 'Test notes',
            p_idempotency_key: 'test-uuid-1234',
          }
        );
      });

      it('should update local harvest and create inventory on success', async () => {
        const mockHarvest = {
          plantId: 'plant-1',
          userId: 'user-1',
          wetWeightG: 100000,
          dryWeightG: mockFinalWeightG,
          stageStartedAt: new Date('2025-01-01'),
        } as HarvestModel;

        const serverTimestamp = Date.now();
        supabase.rpc = jest.fn().mockResolvedValue({
          data: {
            harvest_id: mockHarvestId,
            inventory_id: 'inventory-456',
            server_timestamp_ms: serverTimestamp,
          },
          error: null,
        });

        const mockUpdate = jest.fn().mockResolvedValue({});
        const mockCreate = jest.fn().mockResolvedValue({});
        const mockWrite = jest.fn().mockImplementation(async (fn) => fn());

        (database.get as jest.Mock).mockImplementation((table: string) => {
          if (table === 'harvests') {
            return {
              find: jest.fn().mockResolvedValue({
                ...mockHarvest,
                update: mockUpdate,
              }),
            };
          }
          return { create: mockCreate };
        });

        (database as any).write = mockWrite;

        const result = await InventoryService.completeCuring({
          harvestId: mockHarvestId,
          finalWeightG: mockFinalWeightG,
        });

        expect(result.success).toBe(true);
        expect(result.serverTimestampMs).toBe(serverTimestamp);
        expect(mockUpdate).toHaveBeenCalled();
        expect(mockCreate).toHaveBeenCalled();
      });
    });

    describe('error handling', () => {
      it('should classify 409 as CONCURRENT_FINALIZE', async () => {
        const mockHarvest = {
          plantId: 'plant-1',
          wetWeightG: 100000,
        } as HarvestModel;

        (database.get as jest.Mock).mockReturnValue({
          find: jest.fn().mockResolvedValue(mockHarvest),
        });

        const error409 = {
          response: { status: 409 },
          message: 'Conflict',
        };
        supabase.rpc = jest.fn().mockResolvedValue({
          data: null,
          error: error409,
        });

        const result = await InventoryService.completeCuring({
          harvestId: mockHarvestId,
          finalWeightG: mockFinalWeightG,
        });

        expect(result.success).toBe(false);
        expect(result.errorCode).toBe('CONCURRENT_FINALIZE');
      });

      it('should classify 422 as VALIDATION', async () => {
        const mockHarvest = {
          plantId: 'plant-1',
          wetWeightG: 100000,
        } as HarvestModel;

        (database.get as jest.Mock).mockReturnValue({
          find: jest.fn().mockResolvedValue(mockHarvest),
        });

        const error422 = {
          response: { status: 422 },
          message: 'Validation failed',
        };
        supabase.rpc = jest.fn().mockResolvedValue({
          data: null,
          error: error422,
        });

        const result = await InventoryService.completeCuring({
          harvestId: mockHarvestId,
          finalWeightG: mockFinalWeightG,
        });

        expect(result.success).toBe(false);
        expect(result.errorCode).toBe('VALIDATION');
      });

      it('should classify PostgREST unique_violation (23505) as CONCURRENT_FINALIZE', async () => {
        const mockHarvest = {
          plantId: 'plant-1',
          wetWeightG: 100000,
        } as HarvestModel;

        (database.get as jest.Mock).mockReturnValue({
          find: jest.fn().mockResolvedValue(mockHarvest),
        });

        const postgrestError = {
          code: '23505',
          message: 'duplicate key value violates unique constraint',
          details: 'Key (harvest_id)=(harvest-123) already exists.',
        };
        supabase.rpc = jest.fn().mockResolvedValue({
          data: null,
          error: postgrestError,
        });

        const result = await InventoryService.completeCuring({
          harvestId: mockHarvestId,
          finalWeightG: mockFinalWeightG,
        });

        expect(result.success).toBe(false);
        expect(result.errorCode).toBe('CONCURRENT_FINALIZE');
      });

      it('should classify PostgREST constraint violations (23xxx) as VALIDATION', async () => {
        const mockHarvest = {
          plantId: 'plant-1',
          wetWeightG: 100000,
        } as HarvestModel;

        (database.get as jest.Mock).mockReturnValue({
          find: jest.fn().mockResolvedValue(mockHarvest),
        });

        const postgrestError = {
          code: '23514',
          message: 'new row for relation "inventory" violates check constraint',
          details: 'Failing row contains (final_weight_g) values (0).',
        };
        supabase.rpc = jest.fn().mockResolvedValue({
          data: null,
          error: postgrestError,
        });

        const result = await InventoryService.completeCuring({
          harvestId: mockHarvestId,
          finalWeightG: mockFinalWeightG,
        });

        expect(result.success).toBe(false);
        expect(result.errorCode).toBe('VALIDATION');
      });

      it('should classify validation message errors as VALIDATION', async () => {
        const mockHarvest = {
          plantId: 'plant-1',
          wetWeightG: 100000,
        } as HarvestModel;

        (database.get as jest.Mock).mockReturnValue({
          find: jest.fn().mockResolvedValue(mockHarvest),
        });

        const postgrestError = {
          message: 'validation failed: final weight cannot exceed wet weight',
        };
        supabase.rpc = jest.fn().mockResolvedValue({
          data: null,
          error: postgrestError,
        });

        const result = await InventoryService.completeCuring({
          harvestId: mockHarvestId,
          finalWeightG: mockFinalWeightG,
        });

        expect(result.success).toBe(false);
        expect(result.errorCode).toBe('VALIDATION');
      });

      it('should classify TypeError as NETWORK', async () => {
        const mockHarvest = {
          plantId: 'plant-1',
          wetWeightG: 100000,
        } as HarvestModel;

        (database.get as jest.Mock).mockReturnValue({
          find: jest.fn().mockResolvedValue(mockHarvest),
        });

        supabase.rpc = jest
          .fn()
          .mockRejectedValue(new TypeError('Network request failed'));

        const result = await InventoryService.completeCuring({
          harvestId: mockHarvestId,
          finalWeightG: mockFinalWeightG,
        });

        expect(result.success).toBe(false);
        expect(result.errorCode).toBe('NETWORK');
      });

      it('should classify retryable errors as NETWORK', async () => {
        const mockHarvest = {
          plantId: 'plant-1',
          wetWeightG: 100000,
        } as HarvestModel;

        (database.get as jest.Mock).mockReturnValue({
          find: jest.fn().mockResolvedValue(mockHarvest),
        });

        supabase.rpc = jest
          .fn()
          .mockRejectedValue(new Error('Connection timeout'));

        const result = await InventoryService.completeCuring({
          harvestId: mockHarvestId,
          finalWeightG: mockFinalWeightG,
        });

        expect(result.success).toBe(false);
        expect(result.errorCode).toBe('NETWORK');
      });

      it('should return success with warning if local state update fails', async () => {
        const mockHarvest = {
          plantId: 'plant-1',
          wetWeightG: 100000,
        } as HarvestModel;

        (database.get as jest.Mock).mockReturnValue({
          find: jest.fn().mockResolvedValue(mockHarvest),
        });

        const serverTimestamp = Date.now();
        supabase.rpc = jest.fn().mockResolvedValue({
          data: {
            harvest_id: mockHarvestId,
            inventory_id: 'inventory-456',
            server_timestamp_ms: serverTimestamp,
          },
          error: null,
        });

        // Mock database write to fail
        (database as any).write = jest
          .fn()
          .mockRejectedValue(new Error('DB write failed'));

        const result = await InventoryService.completeCuring({
          harvestId: mockHarvestId,
          finalWeightG: mockFinalWeightG,
        });

        expect(result.success).toBe(true); // Server succeeded
        expect(result.harvest).toBeNull();
        expect(result.inventory).toBeNull();
        expect(result.serverTimestampMs).toBe(serverTimestamp);
        expect(result.error).toContain('Local state update failed');
      });
    });
  });

  describe('getInventoryByHarvestId', () => {
    it('should return inventory for harvest', async () => {
      const mockInventory: Partial<InventoryModel> = {
        id: 'inventory-1',
        plantId: 'plant-1',
        harvestId: 'harvest-123',
        userId: 'user-1',
        finalWeightG: 50000,
        harvestDate: '2025-01-01',
        totalDurationDays: 21,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: undefined,
      };

      const mockFetch = jest
        .fn()
        .mockResolvedValue([mockInventory as InventoryModel]);
      const mockQuery = jest.fn().mockReturnValue({
        fetch: mockFetch,
      });
      (database.get as jest.Mock).mockReturnValue({
        query: mockQuery,
      });

      const result =
        await InventoryService.getInventoryByHarvestId('harvest-123');

      expect(mockQuery).toHaveBeenCalledWith({
        key: 'harvest_id',
        value: 'harvest-123',
      }); // Q.where
      expect(result).toEqual(mockInventory as InventoryModel);
    });

    it('should return null if inventory not found', async () => {
      const mockFetch = jest.fn().mockResolvedValue([]);
      const mockQuery = jest.fn().mockReturnValue({
        fetch: mockFetch,
      });
      (database.get as jest.Mock).mockReturnValue({
        query: mockQuery,
      });

      const result =
        await InventoryService.getInventoryByHarvestId('harvest-123');

      expect(mockQuery).toHaveBeenCalledWith({
        key: 'harvest_id',
        value: 'harvest-123',
      }); // Q.where
      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      (database.get as jest.Mock).mockImplementation(() => {
        throw new Error('DB error');
      });

      const result =
        await InventoryService.getInventoryByHarvestId('harvest-123');

      expect(result).toBeNull();
    });
  });
});
