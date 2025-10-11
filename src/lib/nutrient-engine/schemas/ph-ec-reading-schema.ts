/**
 * Zod schema for pH/EC reading form validation
 *
 * Validates pH/EC measurement inputs with proper ranges and formats
 */

import { z } from 'zod';

import { PpmScale } from '../types';

/**
 * Schema for pH/EC reading form
 *
 * Validates:
 * - pH: 0-14 range
 * - EC raw: 0-10 mS/cm
 * - Temperature: 5-40°C
 * - PPM scale: 500 or 700
 */
export const phEcReadingSchema = z.object({
  ph: z
    .number({
      required_error: 'pH is required',
      invalid_type_error: 'pH must be a number',
    })
    .min(0, 'pH must be at least 0')
    .max(14, 'pH must be at most 14'),

  ecRaw: z
    .number({
      required_error: 'EC is required',
      invalid_type_error: 'EC must be a number',
    })
    .min(0, 'EC must be at least 0 mS/cm')
    .max(10, 'EC must be at most 10 mS/cm'),

  tempC: z
    .number({
      required_error: 'Temperature is required',
      invalid_type_error: 'Temperature must be a number',
    })
    .min(5, 'Temperature must be at least 5°C')
    .max(40, 'Temperature must be at most 40°C'),

  atcOn: z.boolean().default(false),

  ppmScale: z.enum([PpmScale.PPM_500, PpmScale.PPM_700], {
    required_error: 'PPM scale is required',
    invalid_type_error: 'Invalid PPM scale',
  }),

  meterId: z.string().optional(),

  note: z.string().max(500, 'Note must be at most 500 characters').optional(),

  plantId: z.string().optional(),

  reservoirId: z.string().optional(),
});

export type PhEcReadingFormData = z.infer<typeof phEcReadingSchema>;

/**
 * Parse and validate pH/EC reading form data
 */
export function parsePhEcReadingForm(data: unknown): PhEcReadingFormData {
  return phEcReadingSchema.parse(data);
}
