/**
 * Weight Conversion Utilities
 *
 * Handles metric/imperial weight conversion with validation
 * Requirements: 11.1 (integer grams), 11.2 (unit conversion), 11.3 (validation)
 */

const GRAMS_PER_OUNCE = 28.3495;
const MAX_WEIGHT_GRAMS = 100_000;

/**
 * Weight unit type
 */
export type WeightUnit = 'g' | 'oz';

/**
 * Convert grams to ounces
 * @param grams Weight in grams
 * @returns Weight in ounces rounded to 1 decimal place
 */
export function gramsToOunces(grams: number): number {
  return Math.round((grams / GRAMS_PER_OUNCE) * 10) / 10;
}

/**
 * Convert ounces to grams
 * @param ounces Weight in ounces
 * @returns Weight in integer grams (Requirement 11.1)
 */
export function ouncesToGrams(ounces: number): number {
  return Math.round(ounces * GRAMS_PER_OUNCE);
}

/**
 * Format weight for display with appropriate unit
 * Requirement 11.2: Round to 1 decimal place
 *
 * @param grams Weight in integer grams
 * @param unit Display unit ('g' or 'oz')
 * @returns Formatted string with unit
 */
export function formatWeight(grams: number, unit: WeightUnit = 'g'): string {
  if (unit === 'oz') {
    const ounces = gramsToOunces(grams);
    return `${ounces.toFixed(1)} oz`;
  }
  return `${grams} g`;
}

/**
 * Parse weight input string to integer grams
 *
 * @param input Raw input string (numeric)
 * @param unit Input unit ('g' or 'oz')
 * @returns Integer grams or null if invalid
 */
export function parseWeightInput(
  input: string,
  unit: WeightUnit = 'g'
): number | null {
  const trimmed = input.trim();
  if (trimmed === '') return null;

  const value = parseFloat(trimmed);
  if (isNaN(value) || value < 0) return null;

  const grams = unit === 'oz' ? ouncesToGrams(value) : Math.round(value);

  // Requirement 11.3: Validate within bounds
  if (grams > MAX_WEIGHT_GRAMS) return null;

  return grams;
}

/**
 * Validate weight constraints
 * Requirement 11.3: Non-negative, ≤100,000g
 *
 * @param weightG Weight in grams
 * @returns Validation result
 */
export function validateWeight(weightG: number | null | undefined): {
  valid: boolean;
  error?: string;
} {
  if (weightG === null || weightG === undefined) {
    return { valid: true }; // null/undefined means field is optional
  }

  if (weightG < 0) {
    return { valid: false, error: 'Weight must be non-negative' };
  }

  if (weightG > MAX_WEIGHT_GRAMS) {
    return {
      valid: false,
      error: `Weight must be less than ${formatWeight(MAX_WEIGHT_GRAMS)}`,
    };
  }

  return { valid: true };
}

/**
 * Validate dry weight ≤ wet weight constraint
 * Requirement 1.2
 *
 * @param wetWeightG Wet weight in grams
 * @param dryWeightG Dry weight in grams
 * @returns Validation result
 */
export function validateDryLessThanWet(
  wetWeightG: number | null | undefined,
  dryWeightG: number | null | undefined
): {
  valid: boolean;
  error?: string;
} {
  // Only validate if both weights are present
  if (
    wetWeightG === null ||
    wetWeightG === undefined ||
    dryWeightG === null ||
    dryWeightG === undefined
  ) {
    return { valid: true };
  }

  if (dryWeightG > wetWeightG) {
    return {
      valid: false,
      error: 'Dry weight cannot exceed wet weight',
    };
  }

  return { valid: true };
}

/**
 * Convert display value to storage value (integer grams)
 *
 * @param displayValue Value shown in UI
 * @param unit Display unit
 * @returns Integer grams for storage
 */
export function toStorageValue(displayValue: number, unit: WeightUnit): number {
  return unit === 'oz' ? ouncesToGrams(displayValue) : Math.round(displayValue);
}

/**
 * Convert storage value (integer grams) to display value
 *
 * @param storageValue Integer grams from database
 * @param unit Display unit
 * @returns Value for display (rounded to 1 decimal for oz)
 */
export function toDisplayValue(storageValue: number, unit: WeightUnit): number {
  return unit === 'oz' ? gramsToOunces(storageValue) : storageValue;
}
