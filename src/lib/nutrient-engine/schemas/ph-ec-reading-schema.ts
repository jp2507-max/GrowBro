/**
 * Zod schema for pH/EC reading form validation
 *
 * Validates pH/EC measurement inputs with proper ranges and formats
 */

import { z } from 'zod';

import { translate } from '@/lib';

import { PpmScale } from '../types';

/**
 * Custom error map for pH/EC validation messages
 * Translates Zod validation errors to localized messages
 */
// eslint-disable-next-line max-lines-per-function
const phEcErrorMap: z.ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      if (issue.received === 'undefined') {
        switch (issue.path[0]) {
          case 'ph':
            return { message: translate('nutrient.validation.phRequired') };
          case 'ecRaw':
            return { message: translate('nutrient.validation.ecRequired') };
          case 'tempC':
            return { message: translate('nutrient.validation.tempRequired') };
          case 'ppmScale':
            return {
              message: translate('nutrient.validation.ppmScaleRequired'),
            };
        }
      }
      switch (issue.path[0]) {
        case 'ph':
          return { message: translate('nutrient.validation.phInvalidType') };
        case 'ecRaw':
          return { message: translate('nutrient.validation.ecInvalidType') };
        case 'tempC':
          return { message: translate('nutrient.validation.tempInvalidType') };
        case 'ppmScale':
          return { message: translate('nutrient.validation.ppmScaleInvalid') };
      }
      break;

    case z.ZodIssueCode.too_small:
      switch (issue.path[0]) {
        case 'ph':
          return {
            message: translate('nutrient.validation.phMin', {
              min: issue.minimum,
            }),
          };
        case 'ecRaw':
          return {
            message: translate('nutrient.validation.ecMin', {
              min: issue.minimum,
            }),
          };
        case 'tempC':
          return {
            message: translate('nutrient.validation.tempMin', {
              min: issue.minimum,
            }),
          };
      }
      break;

    case z.ZodIssueCode.too_big:
      switch (issue.path[0]) {
        case 'ph':
          return {
            message: translate('nutrient.validation.phMax', {
              max: issue.maximum,
            }),
          };
        case 'ecRaw':
          return {
            message: translate('nutrient.validation.ecMax', {
              max: issue.maximum,
            }),
          };
        case 'tempC':
          return {
            message: translate('nutrient.validation.tempMax', {
              max: issue.maximum,
            }),
          };
        case 'note':
          return {
            message: translate('nutrient.validation.noteMaxLength', {
              max: issue.maximum,
            }),
          };
      }
      break;

    case z.ZodIssueCode.invalid_enum_value:
      if (issue.path[0] === 'ppmScale') {
        return { message: translate('nutrient.validation.ppmScaleInvalid') };
      }
      break;
  }

  // Fallback to default error message
  return { message: ctx.defaultError };
};

/**
 * Schema for pH/EC reading form
 *
 * Validates:
 * - pH: 0-14 range
 * - EC raw: 0-10 mS/cm
 * - Temperature: 5-40°C
 * - PPM scale: 500 or 700
 */
export const phEcReadingSchema = z
  .object({
    ph: z.number().min(0).max(14),

    ecRaw: z.number().min(0).max(10),

    tempC: z.number().min(5).max(40),

    atcOn: z.boolean().default(false),

    ppmScale: z.enum([PpmScale.PPM_500, PpmScale.PPM_700]),

    meterId: z.string().optional(),

    note: z.string().max(500).optional(),

    plantId: z.string().optional(),

    reservoirId: z.string().optional(),
  })
  .strict();

export type PhEcReadingFormData = z.infer<typeof phEcReadingSchema>;

/**
 * Parse and validate pH/EC reading form data with localized error messages
 */
export function parsePhEcReadingForm(data: unknown): PhEcReadingFormData {
  // Store the current error map
  const previousErrorMap = z.getErrorMap();

  // Set our custom error map for localized messages
  z.setErrorMap(phEcErrorMap);

  try {
    // Parse with localized error messages
    return phEcReadingSchema.parse(data);
  } finally {
    // Always restore the previous error map
    z.setErrorMap(previousErrorMap);
  }
}

/**
 * Safe parse version with localized error messages
 */
export function safeParsePhEcReadingForm(data: unknown) {
  // Store the current error map
  const previousErrorMap = z.getErrorMap();

  // Set our custom error map for localized messages
  z.setErrorMap(phEcErrorMap);

  try {
    // Parse with localized error messages
    return phEcReadingSchema.safeParse(data);
  } finally {
    // Always restore the previous error map
    z.setErrorMap(previousErrorMap);
  }
}
