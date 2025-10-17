/**
 * Inventory Deduction Unit Tests
 *
 * Tests core deduction logic without database dependencies.
 *
 * Requirements:
 * - 3.1: Deduction map validation and scaling
 * - 3.3: Idempotency key generation
 */

import {
  validateQuantityPositive,
  validateScalingMode,
} from '@/lib/inventory/deduction-validators';
import { calculateScaledQuantity } from '@/lib/inventory/scaling-calculator';
import type {
  DeductionContext,
  DeductionMapEntry,
} from '@/types/inventory-deduction';

describe('Deduction Validators', () => {
  describe('validateQuantityPositive', () => {
    it('should accept positive quantity', () => {
      const entry: DeductionMapEntry = {
        itemId: 'item-1',
        unit: 'ml',
        perTaskQuantity: 100,
      };

      const error = validateQuantityPositive(entry, 0);
      expect(error).toBeNull();
    });

    it('should reject zero quantity', () => {
      const entry: DeductionMapEntry = {
        itemId: 'item-1',
        unit: 'ml',
        perTaskQuantity: 0,
      };

      const error = validateQuantityPositive(entry, 0);
      expect(error).not.toBeNull();
      expect(error!.code).toBe('INVALID_QUANTITY');
    });

    it('should reject negative quantity', () => {
      const entry: DeductionMapEntry = {
        itemId: 'item-1',
        unit: 'ml',
        perTaskQuantity: -10,
      };

      const error = validateQuantityPositive(entry, 0);
      expect(error).not.toBeNull();
      expect(error!.code).toBe('INVALID_QUANTITY');
    });

    it('should reject missing quantity', () => {
      const entry: DeductionMapEntry = {
        itemId: 'item-1',
        unit: 'ml',
      };

      const error = validateQuantityPositive(entry, 0);
      expect(error).not.toBeNull();
      expect(error!.code).toBe('INVALID_QUANTITY');
    });
  });

  describe('validateScalingMode', () => {
    it('should accept fixed mode with perTaskQuantity', () => {
      const entry: DeductionMapEntry = {
        itemId: 'item-1',
        unit: 'ml',
        perTaskQuantity: 100,
        scalingMode: 'fixed',
      };

      const error = validateScalingMode(entry, 0);
      expect(error).toBeNull();
    });

    it('should reject fixed mode without perTaskQuantity', () => {
      const entry: DeductionMapEntry = {
        itemId: 'item-1',
        unit: 'ml',
        perPlantQuantity: 50,
        scalingMode: 'fixed',
      };

      const error = validateScalingMode(entry, 0);
      expect(error).not.toBeNull();
      expect(error!.code).toBe('INVALID_SCALING');
    });

    it('should accept per-plant mode with perPlantQuantity', () => {
      const entry: DeductionMapEntry = {
        itemId: 'item-1',
        unit: 'ml',
        perPlantQuantity: 50,
        scalingMode: 'per-plant',
      };

      const error = validateScalingMode(entry, 0);
      expect(error).toBeNull();
    });

    it('should reject per-plant mode without perPlantQuantity', () => {
      const entry: DeductionMapEntry = {
        itemId: 'item-1',
        unit: 'ml',
        perTaskQuantity: 100,
        scalingMode: 'per-plant',
      };

      const error = validateScalingMode(entry, 0);
      expect(error).not.toBeNull();
      expect(error!.code).toBe('INVALID_SCALING');
    });
  });
});

describe('Scaling Calculator', () => {
  describe('calculateScaledQuantity', () => {
    it('should return perTaskQuantity for fixed mode', () => {
      const entry: DeductionMapEntry = {
        itemId: 'item-1',
        unit: 'ml',
        perTaskQuantity: 100,
        scalingMode: 'fixed',
      };

      const context: DeductionContext = { taskId: 'task-1' };

      const result = calculateScaledQuantity(entry, context);
      expect(result).toBe(100);
    });

    it('should multiply perPlantQuantity by plantCount', () => {
      const entry: DeductionMapEntry = {
        itemId: 'item-1',
        unit: 'ml',
        perPlantQuantity: 50,
        scalingMode: 'per-plant',
      };

      const context: DeductionContext = {
        taskId: 'task-1',
        plantCount: 3,
      };

      const result = calculateScaledQuantity(entry, context);
      expect(result).toBe(150); // 50ml × 3 plants
    });

    it('should default to 1 plant if plantCount missing', () => {
      const entry: DeductionMapEntry = {
        itemId: 'item-1',
        unit: 'ml',
        perPlantQuantity: 50,
        scalingMode: 'per-plant',
      };

      const context: DeductionContext = { taskId: 'task-1' };

      const result = calculateScaledQuantity(entry, context);
      expect(result).toBe(50); // 50ml × 1 plant (default)
    });

    it('should scale by EC ratio and volume for ec-based mode', () => {
      const entry: DeductionMapEntry = {
        itemId: 'item-1',
        unit: 'ml',
        perTaskQuantity: 10, // Base amount
        scalingMode: 'ec-based',
      };

      const context: DeductionContext = {
        taskId: 'task-1',
        targetEc: 2.4, // Target EC 2.4 mS/cm
        reservoirVolume: 20, // 20 liters
      };

      // Expected: 10ml × (2.4 / 2.0 reference) × (20L / 10L reference)
      // = 10 × 1.2 × 2.0 = 24ml
      const result = calculateScaledQuantity(entry, context);
      expect(result).toBe(24);
    });

    it('should convert PPM to EC for ec-based scaling', () => {
      const entry: DeductionMapEntry = {
        itemId: 'item-1',
        unit: 'ml',
        perTaskQuantity: 10,
        scalingMode: 'ec-based',
      };

      const context: DeductionContext = {
        taskId: 'task-1',
        targetPpm: 1400, // 1400 PPM
        ppmScale: 700, // 700 scale
        reservoirVolume: 10, // 10 liters (matches reference)
      };

      // EC = 1400 / 700 = 2.0 mS/cm (matches reference)
      // Expected: 10ml × (2.0 / 2.0) × (10 / 10) = 10ml
      const result = calculateScaledQuantity(entry, context);
      expect(result).toBe(10);
    });

    it('should fallback to base amount if no EC/PPM provided', () => {
      const entry: DeductionMapEntry = {
        itemId: 'item-1',
        unit: 'ml',
        perTaskQuantity: 15,
        scalingMode: 'ec-based',
      };

      const context: DeductionContext = { taskId: 'task-1' };

      const result = calculateScaledQuantity(entry, context);
      expect(result).toBe(15); // Falls back to base amount
    });
  });
});
