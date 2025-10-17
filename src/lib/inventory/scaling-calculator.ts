/**
 * Scaling Calculator for Inventory Deduction
 *
 * Calculates scaled quantities for per-plant and EC-based deductions.
 * Supports fixed, per-plant, and EC-based (nutrient) scaling modes.
 *
 * Requirements:
 * - 3.1: Per-plant scaling via plant size or EC/ppm
 */

import type {
  DeductionContext,
  DeductionMapEntry,
  ScalingMode,
} from '@/types/inventory-deduction';

/**
 * Calculate scaled quantity based on scaling mode and context
 *
 * @param entry - Deduction map entry with base quantities
 * @param context - Task and plant context for scaling
 * @returns Calculated quantity to deduct
 */
export function calculateScaledQuantity(
  entry: DeductionMapEntry,
  context: DeductionContext
): number {
  const mode: ScalingMode = entry.scalingMode ?? 'fixed';

  switch (mode) {
    case 'fixed':
      return entry.perTaskQuantity ?? 0;

    case 'per-plant':
      return calculatePerPlantQuantity(entry, context);

    case 'ec-based':
      return calculateEcBasedQuantity(entry, context);

    default:
      throw new Error(`Unknown scaling mode: ${mode}`);
  }
}

/**
 * Calculate per-plant scaled quantity
 *
 * Multiplies perPlantQuantity by plant count from context.
 *
 * @param entry - Deduction map entry
 * @param context - Context with plant count
 * @returns Scaled quantity
 */
function calculatePerPlantQuantity(
  entry: DeductionMapEntry,
  context: DeductionContext
): number {
  const perPlant = entry.perPlantQuantity ?? 0;
  const plantCount = context.plantCount ?? 1;

  return perPlant * plantCount;
}

/**
 * Calculate EC-based nutrient quantity
 *
 * Uses target EC/PPM and reservoir volume to calculate nutrient dose.
 * This is a simplified calculation; full nutrient engine integration
 * would use N-P-K ratios and complex mixing logic.
 *
 * Formula: baseAmount * (targetEc / referenceEc) * (reservoirVolume / referenceVolume)
 *
 * @param entry - Deduction map entry with base amount
 * @param context - Context with EC/PPM and reservoir volume
 * @returns Calculated nutrient quantity
 */
function calculateEcBasedQuantity(
  entry: DeductionMapEntry,
  context: DeductionContext
): number {
  const baseAmount = entry.perTaskQuantity ?? 0;

  // Default reference values (adjustable)
  const referenceEc = 2.0; // mS/cm
  const referenceVolume = 10; // liters

  // Extract target EC (convert from PPM if needed)
  let targetEc = context.targetEc;
  if (!targetEc && context.targetPpm && context.ppmScale) {
    // Convert PPM to EC: EC (mS/cm) = PPM / scale
    targetEc = context.targetPpm / context.ppmScale;
  }

  if (!targetEc) {
    // Fallback to base amount if no EC/PPM specified
    return baseAmount;
  }

  const reservoirVolume = context.reservoirVolume ?? referenceVolume;

  // Scale by EC ratio and volume ratio
  const ecRatio = targetEc / referenceEc;
  const volumeRatio = reservoirVolume / referenceVolume;

  return baseAmount * ecRatio * volumeRatio;
}
