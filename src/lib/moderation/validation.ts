/**
 * DSA-compliant validation schemas for content reporting (Art. 16)
 *
 * Implements server-side validation with actionable error messages
 * Requirements: 1.3, 1.4
 */

import { z } from 'zod';

import type { ReportType } from '@/types/moderation';

// ============================================================================
// Validation Schemas
// ============================================================================

const reporterContactSchema = z.object({
  name: z.string().min(1, 'Reporter name is required').optional(),
  email: z
    .string()
    .email('Invalid email format')
    .min(1, 'Reporter email is required')
    .optional(),
  pseudonym: z.string().min(1, 'Pseudonym is required').optional(),
});

const contentReportInputSchema = z
  .object({
    content_id: z.string().min(1, 'Content ID is required'),
    content_type: z.enum(['post', 'comment', 'image', 'profile', 'other'], {
      errorMap: () => ({ message: 'Invalid content type' }),
    }),
    content_locator: z
      .string()
      .min(1, 'Content locator (permalink/deep link) is required')
      .url('Content locator must be a valid URL'),
    report_type: z.enum(['illegal', 'policy_violation'], {
      errorMap: () => ({
        message: 'Report type must be "illegal" or "policy_violation"',
      }),
    }),
    jurisdiction: z
      .string()
      .length(2, 'Jurisdiction must be ISO 3166-1 alpha-2 code (e.g., "DE")')
      .optional(),
    legal_reference: z
      .string()
      .min(1, 'Legal reference is required for illegal content reports')
      .optional(),
    explanation: z
      .string()
      .min(
        50,
        'Explanation must be sufficiently substantiated (minimum 50 characters)'
      )
      .max(5000, 'Explanation is too long (maximum 5000 characters)'),
    reporter_contact: reporterContactSchema,
    good_faith_declaration: z.literal(true, {
      errorMap: () => ({
        message: 'Good faith declaration must be accepted',
      }),
    }),
    evidence_urls: z
      .array(z.string().url('Evidence URL must be valid'))
      .max(10, 'Maximum 10 evidence URLs allowed')
      .optional(),
  })
  .superRefine((data, ctx) => {
    // DSA Art. 16 requirement: illegal content reports must include jurisdiction
    if (data.report_type === 'illegal') {
      if (!data.jurisdiction) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['jurisdiction'],
          message: 'Jurisdiction is required for illegal content reports',
        });
      }
      if (!data.legal_reference) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['legal_reference'],
          message:
            'Legal reference (e.g., "DE StGB §130") is required for illegal content reports',
        });
      }
    }

    // Reporter contact: at least one contact method required
    const contact = data.reporter_contact;
    if (!contact.email && !contact.pseudonym && !contact.name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reporter_contact'],
        message:
          'Reporter contact must include at least email, pseudonym, or name',
      });
    }
  });

// ============================================================================
// Validation Functions
// ============================================================================

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationResult {
  is_valid: boolean;
  errors: ValidationError[];
}

/**
 * Validates content report input against DSA Art. 16 requirements
 *
 * @param input - Content report input payload
 * @returns Validation result with actionable error messages
 */
export function validateContentReportInput(input: unknown): ValidationResult {
  const result = contentReportInputSchema.safeParse(input);

  if (result.success) {
    return {
      is_valid: true,
      errors: [],
    };
  }

  const errors: ValidationError[] = result.error.errors.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
    code: err.code,
  }));

  return {
    is_valid: false,
    errors,
  };
}

/**
 * Validates report type-specific requirements
 *
 * @param reportType - Type of report
 * @param jurisdiction - Jurisdiction code
 * @param legalReference - Legal reference
 * @returns True if valid, throws with actionable error otherwise
 */
export function validateReportTypeRequirements(
  reportType: ReportType,
  jurisdiction?: string,
  legalReference?: string
): void {
  if (reportType === 'illegal') {
    if (!jurisdiction) {
      throw new Error(
        'Jurisdiction is required for illegal content reports. Please specify the country code (e.g., "DE" for Germany).'
      );
    }
    if (!legalReference) {
      throw new Error(
        'Legal reference is required for illegal content reports. Please cite the specific law or regulation (e.g., "DE StGB §130").'
      );
    }
  }
}

/**
 * Validates explanation is sufficiently substantiated (DSA Art. 16 requirement)
 *
 * @param explanation - Report explanation text
 * @returns True if valid, throws with actionable error otherwise
 */
export function validateExplanationSubstantiation(explanation: string): void {
  if (!explanation || explanation.trim().length === 0) {
    throw new Error(
      'Explanation is required. Please provide a detailed description of why this content violates policies or laws.'
    );
  }

  if (explanation.trim().length < 50) {
    throw new Error(
      'Explanation must be sufficiently substantiated (minimum 50 characters). Please provide more detail about the violation.'
    );
  }

  if (explanation.trim().length > 5000) {
    throw new Error(
      'Explanation is too long (maximum 5000 characters). Please be concise.'
    );
  }
}

/**
 * Validates content locator format
 *
 * @param locator - Content locator (permalink/deep link)
 * @returns True if valid, throws with actionable error otherwise
 */
export function validateContentLocator(locator: string): void {
  if (!locator || locator.trim().length === 0) {
    throw new Error(
      'Content locator is required. Please provide a permalink or deep link to the specific content.'
    );
  }

  try {
    new URL(locator);
  } catch {
    throw new Error(
      'Content locator must be a valid URL. Please provide the exact link to the content.'
    );
  }
}

/**
 * Validates good faith declaration
 *
 * @param declaration - Good faith declaration boolean
 * @returns True if valid, throws with actionable error otherwise
 */
export function validateGoodFaithDeclaration(declaration: boolean): void {
  if (declaration !== true) {
    throw new Error(
      'You must declare that you are submitting this report in good faith. Please review the declaration and accept if accurate.'
    );
  }
}

/**
 * Export schema for external use
 */
export { contentReportInputSchema };
