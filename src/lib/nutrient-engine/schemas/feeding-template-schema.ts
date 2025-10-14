/**
 * Zod schema for feeding template form validation
 *
 * Validates feeding template inputs with proper ranges and phase structure
 */

import { z } from 'zod';

import { GrowingMedium, PlantPhase } from '../types';

/**
 * Nutrient ratio schema
 */
const nutrientRatioSchema = z.object({
  nutrient: z.string().min(1, 'Nutrient name is required'),
  value: z
    .number({ required_error: 'Value is required' })
    .positive('Value must be positive'),
  unit: z.enum(['ml/L', 'ppm', 'g/L'], {
    required_error: 'Unit is required',
  }),
});

/**
 * Feeding phase schema with range validation
 */
const feedingPhaseSchema = z
  .object({
    phase: z.enum(
      [
        PlantPhase.SEEDLING,
        PlantPhase.VEGETATIVE,
        PlantPhase.FLOWERING,
        PlantPhase.FLUSH,
      ],
      {
        required_error: 'Phase is required',
      }
    ),
    durationDays: z
      .number({ required_error: 'Duration is required' })
      .int('Duration must be an integer')
      .positive('Duration must be positive'),
    nutrients: z
      .array(nutrientRatioSchema)
      .min(0, 'At least one nutrient is recommended'),
    phRange: z
      .tuple([
        z
          .number({ required_error: 'pH min is required' })
          .min(0, 'pH min must be at least 0')
          .max(14, 'pH min must be at most 14'),
        z
          .number({ required_error: 'pH max is required' })
          .min(0, 'pH max must be at least 0')
          .max(14, 'pH max must be at most 14'),
      ])
      .refine(([min, max]) => min < max, {
        message: 'pH min must be less than pH max',
      }),
    ecRange25c: z
      .tuple([
        z
          .number({ required_error: 'EC min is required' })
          .min(0, 'EC min must be at least 0 mS/cm')
          .max(10, 'EC min must be at most 10 mS/cm'),
        z
          .number({ required_error: 'EC max is required' })
          .min(0, 'EC max must be at least 0 mS/cm')
          .max(10, 'EC max must be at most 10 mS/cm'),
      ])
      .refine(([min, max]) => min < max, {
        message: 'EC min must be less than EC max',
      }),
  })
  .refine(
    (data) => {
      // Validate pH range is reasonable (> 0.1)
      const [phMin, phMax] = data.phRange;
      return phMax - phMin >= 0.1;
    },
    {
      message: 'pH range must be at least 0.1 units wide',
      path: ['phRange'],
    }
  )
  .refine(
    (data) => {
      // Validate EC range is reasonable (> 0.1)
      const [ecMin, ecMax] = data.ecRange25c;
      return ecMax - ecMin >= 0.1;
    },
    {
      message: 'EC range must be at least 0.1 mS/cm wide',
      path: ['ecRange25c'],
    }
  );

/**
 * Feeding template schema
 */
export const feedingTemplateSchema = z.object({
  name: z
    .string({ required_error: 'Template name is required' })
    .min(3, 'Template name must be at least 3 characters')
    .max(100, 'Template name must be at most 100 characters'),
  medium: z.enum(
    [
      GrowingMedium.SOIL,
      GrowingMedium.COCO,
      GrowingMedium.HYDRO,
      GrowingMedium.SOILLESS,
      GrowingMedium.PEAT,
    ],
    {
      required_error: 'Growing medium is required',
    }
  ),
  phases: z
    .array(feedingPhaseSchema)
    .min(1, 'At least one phase is required')
    .refine(
      (phases) => {
        // Ensure phase order is valid (no duplicates)
        const phaseTypes = phases.map((p) => p.phase);
        return new Set(phaseTypes).size === phaseTypes.length;
      },
      {
        message: 'Each phase type can only appear once',
      }
    ),
  isCustom: z.boolean().default(false),
});

export type FeedingTemplateFormData = z.infer<typeof feedingTemplateSchema>;
export type FeedingPhaseFormData = z.infer<typeof feedingPhaseSchema>;
export type NutrientRatioFormData = z.infer<typeof nutrientRatioSchema>;

/**
 * Parse and validate feeding template form data
 */
export function parseFeedingTemplateForm(
  data: unknown
): FeedingTemplateFormData {
  return feedingTemplateSchema.parse(data);
}
