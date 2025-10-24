/**
 * Privacy and Data Retention Types
 * Implements GDPR compliance for moderation system
 */

import { z } from 'zod';

/**
 * Legal bases for data processing under GDPR Art. 6(1)
 */
export const LegalBasisSchema = z.enum([
  'consent', // Art. 6(1)(a) - User consent
  'contract', // Art. 6(1)(b) - Contract performance
  'legal_obligation', // Art. 6(1)(c) - Legal obligation (DSA compliance)
  'vital_interests', // Art. 6(1)(d) - Vital interests (safety)
  'public_task', // Art. 6(1)(e) - Public task
  'legitimate_interests', // Art. 6(1)(f) - Legitimate interests
]);

export type LegalBasis = z.infer<typeof LegalBasisSchema>;

/**
 * Data categories for GDPR classification
 */
export const DataCategorySchema = z.enum([
  'identity', // Name, email, user ID
  'contact', // Email, phone
  'content', // Posts, comments, images
  'behavioral', // Usage patterns, interactions
  'technical', // IP address, device info
  'moderation', // Reports, decisions, appeals
  'audit', // Audit logs, signatures
]);

export type DataCategory = z.infer<typeof DataCategorySchema>;

/**
 * Retention period configuration
 */
export const RetentionPeriodSchema = z.object({
  dataCategory: DataCategorySchema,
  retentionDays: z.number().int().positive(),
  legalBasis: LegalBasisSchema,
  purpose: z.string(),
  gracePeriodDays: z.number().int().nonnegative().default(30),
  canExtend: z.boolean().default(false),
  extensionReason: z.string().optional(),
});

export type RetentionPeriod = z.infer<typeof RetentionPeriodSchema>;

/**
 * Data subject rights under GDPR
 */
export const DataSubjectRightSchema = z.enum([
  'access', // Art. 15 - Right to access
  'rectification', // Art. 16 - Right to rectification
  'erasure', // Art. 17 - Right to erasure ("right to be forgotten")
  'restriction', // Art. 18 - Right to restriction of processing
  'portability', // Art. 20 - Right to data portability
  'objection', // Art. 21 - Right to object
  'automated_decision', // Art. 22 - Rights related to automated decision-making
]);

export type DataSubjectRight = z.infer<typeof DataSubjectRightSchema>;

/**
 * Data subject request
 */
export const DataSubjectRequestSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  requestType: DataSubjectRightSchema,
  status: z.enum(['pending', 'in_progress', 'completed', 'rejected']),
  requestedAt: z.date(),
  completedAt: z.date().optional(),
  rejectionReason: z.string().optional(),
  exportUrl: z.string().url().optional(), // For access/portability requests
  verificationToken: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type DataSubjectRequest = z.infer<typeof DataSubjectRequestSchema>;

/**
 * Consent record for GDPR compliance
 */
export const ConsentRecordSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  purpose: z.string(),
  legalBasis: LegalBasisSchema,
  consentGiven: z.boolean(),
  consentDate: z.date(),
  withdrawnDate: z.date().optional(),
  version: z.string(), // Privacy policy version
  metadata: z.record(z.unknown()).optional(),
});

export type ConsentRecord = z.infer<typeof ConsentRecordSchema>;

/**
 * Privacy notice
 */
export const PrivacyNoticeSchema = z.object({
  id: z.string().uuid(),
  version: z.string(),
  effectiveDate: z.date(),
  content: z.string(),
  language: z.string().length(2), // ISO 639-1 code
  dataCategories: z.array(DataCategorySchema),
  legalBases: z.array(LegalBasisSchema),
  retentionPeriods: z.array(RetentionPeriodSchema),
  thirdPartyProcessors: z.array(z.string()).optional(),
});

export type PrivacyNotice = z.infer<typeof PrivacyNoticeSchema>;

/**
 * Legal hold for data retention
 */
export const LegalHoldSchema = z.object({
  id: z.string().uuid(),
  targetType: z.enum(['user', 'content', 'report', 'decision', 'appeal']),
  targetId: z.string().uuid(),
  reason: z.string(),
  legalBasis: z.string(),
  createdBy: z.string().uuid(),
  createdAt: z.date(),
  reviewDate: z.date(),
  releasedAt: z.date().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type LegalHold = z.infer<typeof LegalHoldSchema>;

/**
 * Data deletion record
 */
export const DataDeletionRecordSchema = z.object({
  id: z.string().uuid(),
  targetType: z.enum([
    'user',
    'content',
    'report',
    'decision',
    'appeal',
    'audit',
  ]),
  targetId: z.string().uuid(),
  deletionType: z.enum(['logical', 'physical']),
  deletedAt: z.date(),
  deletedBy: z.string().uuid().or(z.literal('system')),
  reason: z.string(),
  retentionPolicy: z.string(),
  tombstoneUntil: z.date().optional(), // For two-stage deletion
  metadata: z.record(z.unknown()).optional(),
});

export type DataDeletionRecord = z.infer<typeof DataDeletionRecordSchema>;

/**
 * Data export format
 */
export const DataExportFormatSchema = z.enum(['json', 'csv', 'xml', 'pdf']);

export type DataExportFormat = z.infer<typeof DataExportFormatSchema>;

/**
 * User data export request
 */
export const UserDataExportSchema = z.object({
  userId: z.string().uuid(),
  format: DataExportFormatSchema,
  includeCategories: z.array(DataCategorySchema),
  dateRange: z
    .object({
      from: z.date(),
      to: z.date(),
    })
    .optional(),
});

export type UserDataExport = z.infer<typeof UserDataExportSchema>;

/**
 * Data minimization rule
 */
export const DataMinimizationRuleSchema = z.object({
  dataCategory: DataCategorySchema,
  purpose: z.string(),
  legalBasis: LegalBasisSchema,
  minimumFields: z.array(z.string()),
  optionalFields: z.array(z.string()),
  prohibitedFields: z.array(z.string()),
  anonymizationThreshold: z.number().int().positive().optional(),
});

export type DataMinimizationRule = z.infer<typeof DataMinimizationRuleSchema>;

/**
 * Retention policy configuration
 */
export interface RetentionPolicyConfig {
  // Default retention periods by data category
  defaultRetentionDays: Record<DataCategory, number>;

  // Grace period before physical deletion (tombstone period)
  gracePeriodDays: number;

  // Audit log retention (longer for compliance)
  auditRetentionDays: number;

  // Transparency metrics retention (anonymized)
  transparencyMetricsRetentionDays: number;

  // Legal hold review cadence
  legalHoldReviewDays: number;
}

/**
 * Default retention policy
 */
export const DEFAULT_RETENTION_POLICY: RetentionPolicyConfig = {
  defaultRetentionDays: {
    identity: 1825, // 5 years
    contact: 1825, // 5 years
    content: 1825, // 5 years
    behavioral: 365, // 1 year
    technical: 90, // 90 days
    moderation: 1825, // 5 years (regulatory requirement)
    audit: 2555, // 7 years (forensic/regulatory)
  },
  gracePeriodDays: 30,
  auditRetentionDays: 2555, // 7 years
  transparencyMetricsRetentionDays: 2555, // 7 years (anonymized)
  legalHoldReviewDays: 90,
};
