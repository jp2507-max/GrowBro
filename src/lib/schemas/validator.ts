/**
 * Schema Validator using Zod
 *
 * Provides validation for playbook schemas with format annotations
 * for time strings and ISO datetimes.
 */

import { DateTime } from 'luxon';
import { z } from 'zod';

/**
 * Validation result type
 */
export type ValidationResult =
  | { valid: true }
  | {
      valid: false;
      errors: {
        path: string;
        message: string;
      }[];
    };

// Custom refinements for time and RRULE formats
const timeFormatRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
const rruleFormatRegex = /^FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)/;

// Playbook Step Schema
const playbookStepSchema = z.object({
  id: z.string().min(1),
  phase: z.enum(['seedling', 'veg', 'flower', 'harvest']),
  title: z.string().min(1).max(200),
  descriptionIcu: z.string(),
  relativeDay: z.number().int().min(0),
  rrule: z
    .string()
    .regex(
      rruleFormatRegex,
      'RRULE must start with FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)'
    )
    .optional(),
  defaultReminderLocal: z
    .string()
    .regex(timeFormatRegex, 'Time must be in HH:mm format'),
  taskType: z.enum([
    'water',
    'feed',
    'prune',
    'train',
    'monitor',
    'note',
    'custom',
  ]),
  durationDays: z.number().int().min(1).optional(),
  dependencies: z.array(z.string()),
});

// Playbook Metadata Schema
const playbookMetadataSchema = z.object({
  author: z.string().max(100).optional(),
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/)
    .optional(),
  tags: z.array(z.string().max(50)).optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  estimatedDuration: z.number().int().min(1).optional(),
  strainTypes: z.array(z.string().max(100)).optional(),
});

// Playbook Schema
export const playbookSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  setup: z.enum([
    'auto_indoor',
    'auto_outdoor',
    'photo_indoor',
    'photo_outdoor',
  ]),
  locale: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/),
  phaseOrder: z.array(z.enum(['seedling', 'veg', 'flower', 'harvest'])).min(1),
  steps: z.array(playbookStepSchema).min(1),
  metadata: playbookMetadataSchema,
  isTemplate: z.boolean(),
  isCommunity: z.boolean(),
  authorHandle: z.string().max(100).optional(),
  license: z.string().max(50).optional(),
});

/**
 * Validate a playbook against the Zod schema
 */
export function validatePlaybookSchema(data: unknown): ValidationResult {
  const result = playbookSchema.safeParse(data);

  if (result.success) {
    return { valid: true };
  }

  const errors = result.error.errors.map((error) => ({
    path: error.path.join('.') || 'root',
    message: error.message,
  }));

  return {
    valid: false,
    errors,
  };
}

/**
 * Validate RRULE format (basic check)
 * Full validation should use rrule library
 */
export function validateRRULEFormat(rrule: string): boolean {
  // Basic format check - must start with FREQ=
  if (!rrule.startsWith('FREQ=')) {
    return false;
  }

  // Check for valid frequency values
  const freqMatch = rrule.match(/FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)/);
  if (!freqMatch) {
    return false;
  }

  return true;
}

/**
 * Validate time string format (HH:mm)
 */
export function validateTimeFormat(time: string): boolean {
  return timeFormatRegex.test(time);
}

/**
 * Validate ISO datetime format
 */
export function validateISODatetime(datetime: string): boolean {
  return DateTime.fromISO(datetime, { setZone: true }).isValid;
}

/**
 * Get human-readable error messages from validation result
 */
export function formatValidationErrors(result: ValidationResult): string[] {
  if (result.valid) {
    return [];
  }

  return result.errors.map((error) => {
    const path = error.path === 'root' ? 'root' : error.path;
    return `${path}: ${error.message}`;
  });
}
