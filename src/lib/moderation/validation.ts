/**
 * DSA-compliant validation schemas for content reporting (Art. 16)
 *
 * Implements server-side validation with actionable error messages
 * Requirements: 1.3, 1.4
 */

import { contentReportInputSchema } from '@/lib/schemas/moderation-schemas';
import type { ReportType } from '@/types/moderation';

// ============================================================================
// Validation Functions
// ============================================================================

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface DetailedValidationResult {
  is_valid: boolean;
  errors: ValidationError[];
}

/**
 * Validates content report input against DSA Art. 16 requirements
 *
 * @param input - Content report input payload
 * @returns Validation result with actionable error messages
 */
export function validateContentReportInput(
  input: unknown
): DetailedValidationResult {
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
