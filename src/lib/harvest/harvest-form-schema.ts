/**
 * Harvest Form Validation Schema
 *
 * Zod schema for harvest form validation with weight constraints
 * Requirements: 1.2 (dry ≤ wet), 11.3 (bounds validation)
 */

import { z } from 'zod';

import type { WeightUnit } from './weight-conversion';
import { parseWeightInput, validateDryLessThanWet } from './weight-conversion';

/**
 * Raw form data (display values before conversion)
 */
export const harvestFormSchema = z
  .object({
    /** Wet weight input (in selected unit) */
    wetWeight: z
      .string()
      .optional()
      .transform((val) => (val?.trim() === '' ? undefined : val)),

    /** Dry weight input (in selected unit) */
    dryWeight: z
      .string()
      .optional()
      .transform((val) => (val?.trim() === '' ? undefined : val)),

    /** Trimmings weight input (in selected unit) */
    trimmingsWeight: z
      .string()
      .optional()
      .transform((val) => (val?.trim() === '' ? undefined : val)),

    /** Selected weight unit for display */
    unit: z.enum(['g', 'oz']).default('g'),

    /** Quality notes */
    notes: z.string().default(''),
  })
  .superRefine((data, ctx) => {
    const unit = data.unit as WeightUnit;

    // Parse weight inputs to integer grams
    const wetWeightG = data.wetWeight
      ? parseWeightInput(data.wetWeight, unit)
      : null;
    const dryWeightG = data.dryWeight
      ? parseWeightInput(data.dryWeight, unit)
      : null;
    const trimmingsWeightG = data.trimmingsWeight
      ? parseWeightInput(data.trimmingsWeight, unit)
      : null;

    // Validate wet weight
    if (data.wetWeight && wetWeightG === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['wetWeight'],
        message: 'harvest.validation.invalidWeight',
      });
    }

    // Validate dry weight
    if (data.dryWeight && dryWeightG === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dryWeight'],
        message: 'harvest.validation.invalidWeight',
      });
    }

    // Validate trimmings weight
    if (data.trimmingsWeight && trimmingsWeightG === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['trimmingsWeight'],
        message: 'harvest.validation.invalidWeight',
      });
    }

    // Requirement 1.2: Validate dry ≤ wet if both present
    const dryWetValidation = validateDryLessThanWet(wetWeightG, dryWeightG);
    if (!dryWetValidation.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dryWeight'],
        message: 'harvest.validation.dryExceedsWet',
      });
    }
  });

export type HarvestFormData = z.infer<typeof harvestFormSchema>;

/**
 * Parsed harvest data with weights converted to integer grams
 * Ready for database storage (Requirement 11.1)
 */
export interface ParsedHarvestData {
  wetWeightG: number | null;
  dryWeightG: number | null;
  trimmingsWeightG: number | null;
  notes: string;
}

/**
 * Convert validated form data to storage format
 *
 * @param formData Validated form data
 * @returns Parsed data with integer gram weights
 */
export function parseHarvestFormData(
  formData: HarvestFormData
): ParsedHarvestData {
  const unit = formData.unit as WeightUnit;

  return {
    wetWeightG: formData.wetWeight
      ? parseWeightInput(formData.wetWeight, unit)
      : null,
    dryWeightG: formData.dryWeight
      ? parseWeightInput(formData.dryWeight, unit)
      : null,
    trimmingsWeightG: formData.trimmingsWeight
      ? parseWeightInput(formData.trimmingsWeight, unit)
      : null,
    notes: formData.notes,
  };
}
