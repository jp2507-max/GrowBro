/**
 * Zod Validation Schemas for DSA-Compliant Moderation System
 *
 * Implements server-side validation for:
 * - Content Reports (DSA Art. 16)
 * - Statements of Reasons (DSA Art. 17 & 24(5))
 * - Trusted Flaggers (DSA Art. 22)
 * - Repeat Offenders (DSA Art. 23)
 *
 * Requirements: 1.3, 1.4, 11.2, 12.1
 */

import { z } from 'zod';

import type { ValidationResult } from '@/types/moderation';

// ============================================================================
// Content Reports (DSA Art. 16)
// ============================================================================

/**
 * Reporter contact schema (DSA Art. 16(c))
 * Supports pseudonymous reporting with contextual exceptions
 */
export const reporterContactSchema = z.object({
  name: z.string().min(1, 'Reporter name is required').optional(),
  email: z
    .string()
    .email('Invalid email format')
    .min(1, 'Reporter email is required')
    .optional(),
  pseudonym: z.string().min(1, 'Pseudonym is required').optional(),
});

/**
 * Content report input schema (DSA Art. 16)
 * Implements two-track system: illegal content vs policy violations
 *
 * Mandatory fields per Art. 16:
 * - explanation: sufficiently substantiated (min 50 chars)
 * - content_locator: exact deep link/ID/URL
 * - reporter_contact: name & email (or pseudonym for privacy)
 * - good_faith_declaration: must be true
 */
export const contentReportInputSchema = z
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

/**
 * Validate content report input with actionable error messages
 */
export function validateContentReport(
  data: unknown
): ValidationResult & { data?: z.infer<typeof contentReportInputSchema> } {
  const result = contentReportInputSchema.safeParse(data);

  if (result.success) {
    return { is_valid: true, errors: [], data: result.data };
  }

  const errors = result.error.errors.map((error) => {
    const path = error.path.join('.') || 'root';
    return `${path}: ${error.message}`;
  });

  return {
    is_valid: false,
    errors,
  };
}

// ============================================================================
// Statements of Reasons (DSA Art. 17 & 24(5))
// ============================================================================

/**
 * Statement of Reasons input schema (DSA Art. 17)
 *
 * Required fields per Art. 17(3)(c):
 * - decision_ground: 'illegal' or 'terms'
 * - legal_reference: mandatory if decision_ground = 'illegal'
 * - facts_and_circumstances: detailed explanation
 * - automated_detection/automated_decision: transparency on automation usage
 * - territorial_scope: affected jurisdictions
 * - redress: available complaint mechanisms (Art. 20, 21)
 */
export const statementOfReasonsInputSchema = z
  .object({
    decision_id: z.string().uuid('Decision ID must be a valid UUID'),
    decision_ground: z.enum(['illegal', 'terms'], {
      errorMap: () => ({
        message:
          'Decision ground must be either "illegal" (unlawful content) or "terms" (policy violation)',
      }),
    }),
    legal_reference: z
      .string()
      .min(1)
      .max(500, 'Legal reference is too long')
      .optional(),
    content_type: z.enum(['post', 'comment', 'image', 'profile', 'other']),
    facts_and_circumstances: z
      .string()
      .min(100, 'Facts and circumstances must be detailed (min 100 characters)')
      .max(5000, 'Facts and circumstances is too long'),
    automated_detection: z.boolean({
      errorMap: () => ({
        message:
          'Must disclose whether automated means were used for detection',
      }),
    }),
    automated_decision: z.boolean({
      errorMap: () => ({
        message: 'Must disclose whether automated means were used for decision',
      }),
    }),
    territorial_scope: z
      .array(
        z
          .string()
          .length(2, 'Each territory must be a 2-letter ISO country code')
          .toUpperCase()
      )
      .min(1, 'At least one territory must be specified')
      .max(50, 'Too many territories specified')
      .optional(),
    redress: z
      .array(z.enum(['internal_appeal', 'ods', 'court']))
      .min(1, 'At least one redress option must be provided')
      .max(3),
  })
  .refine(
    (data) => {
      // For illegal content, legal_reference is mandatory
      if (data.decision_ground === 'illegal' && !data.legal_reference) {
        return false;
      }
      return true;
    },
    {
      message:
        'Legal reference is required for illegal content decisions (e.g., "DE StGB §130")',
      path: ['legal_reference'],
    }
  );

/**
 * Validate Statement of Reasons input
 */
export function validateStatementOfReasons(data: unknown): ValidationResult & {
  data?: z.infer<typeof statementOfReasonsInputSchema>;
} {
  const result = statementOfReasonsInputSchema.safeParse(data);

  if (result.success) {
    return { is_valid: true, errors: [], data: result.data };
  }

  const errors = result.error.errors.map((error) => {
    const path = error.path.join('.') || 'root';
    return `${path}: ${error.message}`;
  });

  return {
    is_valid: false,
    errors,
  };
}

/**
 * Redacted SoR schema for DSA Transparency Database submission (Art. 24(5))
 * Contains only non-PII fields and aggregated/pseudonymized data
 */
export const redactedSoRSchema = z.object({
  decision_id: z.string().uuid(),
  decision_ground: z.enum(['illegal', 'terms']),
  legal_reference: z.string().optional(),
  content_type: z.enum(['post', 'comment', 'image', 'profile', 'other']),
  automated_detection: z.boolean(),
  automated_decision: z.boolean(),
  territorial_scope: z
    .array(z.string().length(2).toUpperCase())
    .max(50)
    .optional(),
  redress: z
    .array(z.enum(['internal_appeal', 'ods', 'court']))
    .min(1)
    .max(3),
  transparency_db_id: z.string().optional(),
  created_at: z.date(),
  aggregated_data: z.object({
    report_count: z.union([z.number().int().min(0), z.literal('suppressed')]),
    evidence_type: z.enum(['text', 'image', 'video', 'mixed']),
    content_age: z.enum(['new', 'recent', 'archived']),
    jurisdiction_count: z.union([
      z.number().int().min(0),
      z.literal('suppressed'),
    ]),
    has_trusted_flagger: z.boolean(),
  }),
  pseudonymized_reporter_id: z.string().length(16),
  pseudonymized_moderator_id: z.string().length(16),
  pseudonymized_decision_id: z.string().length(16),
  scrubbing_metadata: z.object({
    scrubbed_at: z.date(),
    scrubbing_version: z.string().regex(/^\d+\.\d+\.\d+$/),
    redacted_fields: z.array(z.string()).min(1),
    environment_salt_version: z.string(),
    aggregation_suppression: z.object({
      report_count: z.boolean(),
      jurisdiction_count: z.boolean(),
      k: z.number().int().min(1).max(100),
    }),
  }),
});

// ============================================================================
// Trusted Flaggers (DSA Art. 22)
// ============================================================================

/**
 * Contact info schema for trusted flaggers
 */
export const contactInfoSchema = z.object({
  email: z.string().email().max(255),
  phone: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
});

/**
 * Quality metrics schema for trusted flagger performance tracking
 */
export const qualityMetricsSchema = z.object({
  accuracy_rate: z
    .number()
    .min(0, 'Accuracy rate must be at least 0%')
    .max(100, 'Accuracy rate cannot exceed 100%')
    .optional(),
  average_handling_time_hours: z
    .number()
    .min(0, 'Average handling time must be positive')
    .optional(),
  total_reports: z.number().int().min(0, 'Total reports must be non-negative'),
  upheld_decisions: z
    .number()
    .int()
    .min(0, 'Upheld decisions must be non-negative'),
});

/**
 * Trusted flagger input schema (DSA Art. 22)
 *
 * Supports priority intake, periodic quality analytics, and role criteria
 */
export const trustedFlaggerInputSchema = z.object({
  organization_name: z.string().min(1).max(200),
  contact_info: contactInfoSchema,
  specialization: z
    .array(z.string().max(100))
    .min(1, 'At least one specialization area is required')
    .max(20, 'Too many specialization areas'),
  status: z.enum(['active', 'suspended', 'revoked']).default('active'),
  quality_metrics: qualityMetricsSchema.optional(),
  certification_date: z.date(),
  review_date: z.date(),
});

/**
 * Validate trusted flagger input
 */
export function validateTrustedFlagger(
  data: unknown
): ValidationResult & { data?: z.infer<typeof trustedFlaggerInputSchema> } {
  const result = trustedFlaggerInputSchema.safeParse(data);

  if (result.success) {
    return { is_valid: true, errors: [], data: result.data };
  }

  const errors = result.error.errors.map((error) => {
    const path = error.path.join('.') || 'root';
    return `${path}: ${error.message}`;
  });

  return {
    is_valid: false,
    errors,
  };
}

// ============================================================================
// Repeat Offenders (DSA Art. 23)
// ============================================================================

/**
 * Suspension record schema for graduated enforcement tracking
 */
export const suspensionRecordSchema = z.object({
  start: z.date(),
  end: z.date().optional(),
  reason: z.string().min(1).max(1000),
  duration_days: z.number().int().min(1).max(36500).optional(), // Max ~100 years
});

/**
 * Repeat offender record input schema (DSA Art. 23)
 *
 * Implements graduated enforcement: warnings → temporary suspension → permanent ban
 * Tracks manifestly unfounded reporters per Art. 23
 */
export const repeatOffenderRecordInputSchema = z.object({
  user_id: z.string().min(1),
  violation_type: z.string().min(1).max(100),
  violation_count: z
    .number()
    .int()
    .min(1, 'Violation count must be at least 1'),
  escalation_level: z.enum([
    'warning',
    'temporary_suspension',
    'permanent_ban',
  ]),
  last_violation_date: z.date().optional(),
  suspension_history: z
    .array(suspensionRecordSchema)
    .max(100, 'Suspension history is too large')
    .default([]),
  manifestly_unfounded_reports: z
    .number()
    .int()
    .min(0, 'Manifestly unfounded reports must be non-negative')
    .default(0),
  status: z.enum(['active', 'suspended', 'banned']),
});

/**
 * Validate repeat offender record input
 */
export function validateRepeatOffender(data: unknown): ValidationResult & {
  data?: z.infer<typeof repeatOffenderRecordInputSchema>;
} {
  const result = repeatOffenderRecordInputSchema.safeParse(data);

  if (result.success) {
    return { is_valid: true, errors: [], data: result.data };
  }

  const errors = result.error.errors.map((error) => {
    const path = error.path.join('.') || 'root';
    return `${path}: ${error.message}`;
  });

  return {
    is_valid: false,
    errors,
  };
}

// ============================================================================
// Appeals (DSA Art. 20)
// ============================================================================

/**
 * Appeal input schema (DSA Art. 20 Internal Complaint-Handling)
 *
 * Guarantees: human review, non-discrimination, free of charge
 * Appeal windows: ≥7 days minimum (product policy may extend to 14/30 days)
 */
export const appealInputSchema = z.object({
  original_decision_id: z.string().uuid('Decision ID must be a valid UUID'),
  user_id: z.string().min(1),
  appeal_type: z.enum(['content_removal', 'account_action', 'geo_restriction']),
  counter_arguments: z
    .string()
    .min(50, 'Counter-arguments must be detailed (min 50 characters)')
    .max(5000, 'Counter-arguments is too long'),
  supporting_evidence: z
    .array(z.string().url('Each evidence URL must be valid'))
    .max(10, 'Maximum 10 evidence URLs allowed')
    .optional(),
});

/**
 * Validate appeal input
 */
export function validateAppeal(
  data: unknown
): ValidationResult & { data?: z.infer<typeof appealInputSchema> } {
  const result = appealInputSchema.safeParse(data);

  if (result.success) {
    return { is_valid: true, errors: [], data: result.data };
  }

  const errors = result.error.errors.map((error) => {
    const path = error.path.join('.') || 'root';
    return `${path}: ${error.message}`;
  });

  return {
    is_valid: false,
    errors,
  };
}

// ============================================================================
// Audit Events
// ============================================================================

/**
 * Audit event input schema
 * For immutable audit trail with cryptographic signatures
 */
export const auditEventInputSchema = z.object({
  event_type: z.enum([
    'report_submitted',
    'decision_made',
    'appeal_filed',
    'sor_submitted',
    'partition_sealed',
    'signature_verified',
    'audit_integrity_check',
    'legal_hold_applied',
    'court_order_received',
  ]),
  actor_id: z.string().min(1),
  actor_type: z.enum(['user', 'moderator', 'system']),
  target_id: z.string().min(1),
  target_type: z.string().min(1).max(100),
  action: z.string().min(1).max(200),
  metadata: z.record(z.unknown()).optional(),
  pii_tagged: z.boolean().default(false),
});

/**
 * Validate audit event input
 */
export function validateAuditEvent(
  data: unknown
): ValidationResult & { data?: z.infer<typeof auditEventInputSchema> } {
  const result = auditEventInputSchema.safeParse(data);

  if (result.success) {
    return { is_valid: true, errors: [], data: result.data };
  }

  const errors = result.error.errors.map((error) => {
    const path = error.path.join('.') || 'root';
    return `${path}: ${error.message}`;
  });

  return {
    is_valid: false,
    errors,
  };
}

// ============================================================================
// Export All Schemas
// ============================================================================

export const moderationSchemas = {
  contentReportInput: contentReportInputSchema,
  reporterContact: reporterContactSchema,
  statementOfReasonsInput: statementOfReasonsInputSchema,
  redactedSoR: redactedSoRSchema,
  trustedFlaggerInput: trustedFlaggerInputSchema,
  contactInfo: contactInfoSchema,
  qualityMetrics: qualityMetricsSchema,
  repeatOffenderRecordInput: repeatOffenderRecordInputSchema,
  suspensionRecord: suspensionRecordSchema,
  appealInput: appealInputSchema,
  auditEventInput: auditEventInputSchema,
};
