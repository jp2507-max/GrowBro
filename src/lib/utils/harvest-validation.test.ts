/**
 * Tests for harvest validation utilities
 * Requirements: 11.3 (validation rules)
 */

import { HarvestStage } from '@/types';

import {
  getNextStage,
  isValidStage,
  isValidTransition,
  MAX_WEIGHT_G,
  MIN_WEIGHT_G,
  validateFinalWeight,
  validateWeight,
  validateWeights,
} from './harvest-validation';

describe('harvest-validation', () => {
  describe('validateWeight', () => {
    it('should return null for valid weights', () => {
      expect(validateWeight(0, 'wet_weight_g')).toBeNull();
      expect(validateWeight(1000, 'dry_weight_g')).toBeNull();
      expect(validateWeight(MAX_WEIGHT_G, 'trimmings_weight_g')).toBeNull();
    });

    it('should return null for null/undefined (optional)', () => {
      expect(validateWeight(null, 'wet_weight_g')).toBeNull();
      expect(validateWeight(undefined, 'dry_weight_g')).toBeNull();
    });

    it('should reject negative weights (Requirement 11.3)', () => {
      const error = validateWeight(-1, 'wet_weight_g');
      expect(error).not.toBeNull();
      expect(error?.field).toBe('wet_weight_g');
      expect(error?.message).toContain('non-negative');
    });

    it('should reject weights exceeding maximum (Requirement 11.3)', () => {
      const error = validateWeight(MAX_WEIGHT_G + 1, 'dry_weight_g');
      expect(error).not.toBeNull();
      expect(error?.field).toBe('dry_weight_g');
      expect(error?.message).toContain(`${MAX_WEIGHT_G}g`);
    });

    it('should reject non-integer weights (Requirement 11.1)', () => {
      const error = validateWeight(100.5, 'trimmings_weight_g');
      expect(error).not.toBeNull();
      expect(error?.field).toBe('trimmings_weight_g');
      expect(error?.message).toContain('integer');
    });

    it('should reject invalid numbers', () => {
      const error = validateWeight(NaN, 'wet_weight_g');
      expect(error).not.toBeNull();
      expect(error?.message).toContain('valid number');
    });
  });

  describe('validateWeights', () => {
    it('should return empty array for all valid weights', () => {
      const errors = validateWeights(1000, 800, 200);
      expect(errors).toHaveLength(0);
    });

    it('should return empty array for null weights', () => {
      const errors = validateWeights(null, null, null);
      expect(errors).toHaveLength(0);
    });

    it('should validate all weights independently', () => {
      // Use valid wet weight to avoid dry>wet constraint error
      const errors = validateWeights(10000, MAX_WEIGHT_G + 1, 100.5);
      expect(errors.length).toBeGreaterThanOrEqual(2);
      expect(errors.some((e) => e.field === 'dry_weight_g')).toBe(true);
      expect(errors.some((e) => e.field === 'trimmings_weight_g')).toBe(true);
    });

    it('should enforce dry weight ≤ wet weight (Requirement 11.3)', () => {
      const errors = validateWeights(800, 1000, 100);
      expect(errors).toHaveLength(1);
      expect(errors[0].field).toBe('dry_weight_g');
      expect(errors[0].message).toContain('cannot exceed wet weight');
    });

    it('should allow dry weight = wet weight', () => {
      const errors = validateWeights(1000, 1000, 200);
      expect(errors).toHaveLength(0);
    });

    it('should not check dry≤wet when one is null', () => {
      expect(validateWeights(1000, null, 100)).toHaveLength(0);
      expect(validateWeights(null, 800, 100)).toHaveLength(0);
    });
  });

  describe('isValidStage', () => {
    it('should return true for valid stages', () => {
      expect(isValidStage(HarvestStage.HARVEST)).toBe(true);
      expect(isValidStage(HarvestStage.DRYING)).toBe(true);
      expect(isValidStage(HarvestStage.CURING)).toBe(true);
      expect(isValidStage(HarvestStage.INVENTORY)).toBe(true);
    });

    it('should return false for invalid stages', () => {
      expect(isValidStage('invalid')).toBe(false);
      expect(isValidStage('')).toBe(false);
      expect(isValidStage(null)).toBe(false);
      expect(isValidStage(undefined)).toBe(false);
      expect(isValidStage(123)).toBe(false);
    });
  });

  describe('getNextStage', () => {
    it('should return correct next stages in FSM', () => {
      expect(getNextStage(HarvestStage.HARVEST)).toBe(HarvestStage.DRYING);
      expect(getNextStage(HarvestStage.DRYING)).toBe(HarvestStage.CURING);
      expect(getNextStage(HarvestStage.CURING)).toBe(HarvestStage.INVENTORY);
    });

    it('should return null for final stage', () => {
      expect(getNextStage(HarvestStage.INVENTORY)).toBeNull();
    });
  });

  describe('isValidTransition', () => {
    it('should allow forward transitions only', () => {
      // Valid forward transitions
      expect(isValidTransition(HarvestStage.HARVEST, HarvestStage.DRYING)).toBe(
        true
      );
      expect(isValidTransition(HarvestStage.DRYING, HarvestStage.CURING)).toBe(
        true
      );
      expect(
        isValidTransition(HarvestStage.CURING, HarvestStage.INVENTORY)
      ).toBe(true);
    });

    it('should reject backward transitions', () => {
      expect(isValidTransition(HarvestStage.DRYING, HarvestStage.HARVEST)).toBe(
        false
      );
      expect(
        isValidTransition(HarvestStage.INVENTORY, HarvestStage.CURING)
      ).toBe(false);
    });

    it('should reject skipping stages', () => {
      expect(isValidTransition(HarvestStage.HARVEST, HarvestStage.CURING)).toBe(
        false
      );
      expect(
        isValidTransition(HarvestStage.HARVEST, HarvestStage.INVENTORY)
      ).toBe(false);
      expect(
        isValidTransition(HarvestStage.DRYING, HarvestStage.INVENTORY)
      ).toBe(false);
    });

    it('should reject staying in same stage', () => {
      expect(
        isValidTransition(HarvestStage.HARVEST, HarvestStage.HARVEST)
      ).toBe(false);
    });
  });

  describe('validateFinalWeight', () => {
    it('should return null for valid final weight', () => {
      expect(validateFinalWeight(1000)).toBeNull();
      expect(validateFinalWeight(MAX_WEIGHT_G)).toBeNull();
      expect(validateFinalWeight(MIN_WEIGHT_G)).toBeNull();
    });

    it('should require final weight', () => {
      expect(validateFinalWeight(null)).toContain('required');
      expect(validateFinalWeight(undefined)).toContain('required');
    });

    it('should validate final weight constraints', () => {
      expect(validateFinalWeight(-1)).not.toBeNull();
      expect(validateFinalWeight(MAX_WEIGHT_G + 1)).not.toBeNull();
      expect(validateFinalWeight(100.5)).toContain('integer');
    });
  });

  describe('boundary values', () => {
    it('should accept minimum weight (0g)', () => {
      expect(validateWeight(MIN_WEIGHT_G, 'wet_weight_g')).toBeNull();
    });

    it('should accept maximum weight (100000g)', () => {
      expect(validateWeight(MAX_WEIGHT_G, 'dry_weight_g')).toBeNull();
    });

    it('should reject just below minimum', () => {
      const error = validateWeight(MIN_WEIGHT_G - 1, 'wet_weight_g');
      expect(error).not.toBeNull();
    });

    it('should reject just above maximum', () => {
      const error = validateWeight(MAX_WEIGHT_G + 1, 'dry_weight_g');
      expect(error).not.toBeNull();
    });
  });
});
