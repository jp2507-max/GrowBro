/**
 * Harvest Validation Utilities
 *
 * Validation functions for harvest workflow data
 * Requirements: 11.3 (non-negative, ≤100000g, dry≤wet)
 */

import { HarvestStage, type WeightValidationError } from '@/types';

/**
 * Maximum weight allowed in grams (Requirement 11.3)
 */
export const MAX_WEIGHT_G = 100000;

/**
 * Minimum weight allowed in grams (Requirement 11.3)
 */
export const MIN_WEIGHT_G = 0;

/**
 * Valid harvest stages for FSM validation
 */
const VALID_STAGES: readonly HarvestStage[] = [
  HarvestStage.HARVEST,
  HarvestStage.DRYING,
  HarvestStage.CURING,
  HarvestStage.INVENTORY,
] as const;

/**
 * Validate individual weight value
 *
 * Requirements:
 * - 11.3: Non-negative values
 * - 11.3: Within bounds (≤100,000g)
 *
 * @param weight - Weight value in grams
 * @param fieldName - Name of the field for error messages
 * @returns Error object if invalid, null if valid
 */
export function validateWeight(
  weight: number | null | undefined,
  fieldName: 'wet_weight_g' | 'dry_weight_g' | 'trimmings_weight_g'
): WeightValidationError | null {
  // Null/undefined is allowed (optional field)
  if (weight === null || weight === undefined) {
    return null;
  }

  // Check if it's a valid number
  if (typeof weight !== 'number' || !Number.isFinite(weight)) {
    return {
      field: fieldName,
      message: 'Weight must be a valid number',
    };
  }

  // Requirement 11.3: Non-negative
  if (weight < MIN_WEIGHT_G) {
    return {
      field: fieldName,
      message: `Weight must be non-negative (≥${MIN_WEIGHT_G}g)`,
    };
  }

  // Requirement 11.3: Within bounds
  if (weight > MAX_WEIGHT_G) {
    return {
      field: fieldName,
      message: `Weight must not exceed ${MAX_WEIGHT_G}g`,
    };
  }

  // Check if it's an integer (Requirement 11.1)
  if (!Number.isInteger(weight)) {
    return {
      field: fieldName,
      message: 'Weight must be an integer (no decimal places)',
    };
  }

  return null;
}

/**
 * Validate all harvest weights together
 *
 * Requirements:
 * - 11.3: Individual weight validation
 * - 11.3: Dry weight must be ≤ wet weight when both present
 *
 * @param wetWeightG - Wet weight in grams
 * @param dryWeightG - Dry weight in grams
 * @param trimmingsWeightG - Trimmings weight in grams
 * @returns Array of validation errors (empty if valid)
 */
export function validateWeights(
  wetWeightG: number | null | undefined,
  dryWeightG: number | null | undefined,
  trimmingsWeightG: number | null | undefined
): WeightValidationError[] {
  const errors: WeightValidationError[] = [];

  // Validate individual weights
  const wetError = validateWeight(wetWeightG, 'wet_weight_g');
  if (wetError) errors.push(wetError);

  const dryError = validateWeight(dryWeightG, 'dry_weight_g');
  if (dryError) errors.push(dryError);

  const trimmingsError = validateWeight(trimmingsWeightG, 'trimmings_weight_g');
  if (trimmingsError) errors.push(trimmingsError);

  // Requirement 11.3: Dry weight must be ≤ wet weight
  if (
    wetWeightG !== null &&
    wetWeightG !== undefined &&
    dryWeightG !== null &&
    dryWeightG !== undefined &&
    dryWeightG > wetWeightG
  ) {
    errors.push({
      field: 'dry_weight_g',
      message: 'Dry weight cannot exceed wet weight',
    });
  }

  return errors;
}

/**
 * Type guard to check if a value is a valid HarvestStage
 *
 * @param stage - Value to check
 * @returns True if valid stage, false otherwise
 */
export function isValidStage(stage: unknown): stage is HarvestStage {
  return (
    typeof stage === 'string' && VALID_STAGES.includes(stage as HarvestStage)
  );
}

/**
 * Get the next stage in the harvest FSM
 *
 * Allowed transitions: HARVEST → DRYING → CURING → INVENTORY
 *
 * @param currentStage - Current harvest stage
 * @returns Next stage, or null if at final stage
 */
export function getNextStage(currentStage: HarvestStage): HarvestStage | null {
  const stageIndex = VALID_STAGES.indexOf(currentStage);
  if (stageIndex === -1 || stageIndex === VALID_STAGES.length - 1) {
    return null;
  }
  return VALID_STAGES[stageIndex + 1];
}

/**
 * Check if a stage transition is valid
 *
 * Only forward transitions are allowed in the FSM
 *
 * @param fromStage - Current stage
 * @param toStage - Target stage
 * @returns True if transition is valid
 */
export function isValidTransition(
  fromStage: HarvestStage,
  toStage: HarvestStage
): boolean {
  const fromIndex = VALID_STAGES.indexOf(fromStage);
  const toIndex = VALID_STAGES.indexOf(toStage);

  // Both stages must be valid
  if (fromIndex === -1 || toIndex === -1) {
    return false;
  }

  // Can only move forward (toIndex must be exactly fromIndex + 1)
  return toIndex === fromIndex + 1;
}

/**
 * Validate that final weight is provided for inventory creation
 *
 * @param finalWeightG - Final weight in grams
 * @returns Error message if invalid, null if valid
 */
export function validateFinalWeight(
  finalWeightG: number | null | undefined
): string | null {
  if (finalWeightG === null || finalWeightG === undefined) {
    return 'Final weight is required for inventory creation';
  }

  const error = validateWeight(finalWeightG, 'dry_weight_g');
  return error ? error.message : null;
}
