/**
 * PII Scrubber - DSA Art. 24(5) compliance
 *
 * Implements comprehensive PII redaction for Statement of Reasons exports with:
 * - Field redaction (free-text, contact info, identifiers)
 * - Pseudonymization (HMAC-SHA256 with environment-specific salt)
 * - Aggregation strategy with k-anonymity suppression
 * - Scrubbing metadata tracking
 *
 * Requirements: 3.3 (DSA Art. 24(5))
 */

import { Env } from '@env';
import crypto from 'crypto';

import type { RedactedSoR, StatementOfReasons } from '@/types/moderation';

// ============================================================================
// Types
// ============================================================================

interface ScrubConfig {
  environment: string;
  saltVersion: string;
  kAnonymityThreshold: number;
  baseSalt: string;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_K_ANONYMITY_THRESHOLD = 5;
const SCRUBBING_VERSION = '1.0.0';

/**
 * Fields to be completely redacted from SoR exports
 */
const REDACTED_FIELDS = [
  // Free-text fields
  'facts_and_circumstances',
  'explanation',
  'reasoning',
  'counter_arguments',
  'description',
  'metadata',
  // Direct PII fields
  'reporter_contact',
  'personal_identifiers',
  'contact_info',
  // Actor identifiers (replaced with pseudonyms)
  'reporter_id',
  'moderator_id',
  'user_id',
  // Content locators
  'content_locator',
  'evidence_urls',
  // Evidence data
  'evidence',
  'supporting_evidence',
  // Location/IP data
  'ip_address',
  'location_data',
];

// ============================================================================
// PII Scrubber
// ============================================================================

export class PIIScrubber {
  private config: ScrubConfig;

  constructor(config?: Partial<ScrubConfig>) {
    const environment = config?.environment || 'production';
    let salt = Env.PII_SCRUBBING_SALT;
    if (!salt) {
      if (environment === 'production') {
        throw new Error(
          'PII_SCRUBBING_SALT environment variable is required in production'
        );
      }
      salt = 'default-salt-change-in-development';
    }
    this.config = {
      environment,
      saltVersion: config?.saltVersion || '1',
      kAnonymityThreshold:
        config?.kAnonymityThreshold || DEFAULT_K_ANONYMITY_THRESHOLD,
      baseSalt: salt,
    };
  }

  /**
   * Scrubs PII from Statement of Reasons for Commission DB submission
   *
   * Requirements: 3.3 (DSA Art. 24(5))
   */
  async scrubStatementOfReasons(
    sor: StatementOfReasons,
    context: {
      report_count: number;
      evidence_type: 'text' | 'image' | 'video' | 'mixed';
      content_age: 'new' | 'recent' | 'archived';
      jurisdiction_count: number;
      has_trusted_flagger: boolean;
      moderator_id?: string;
    }
  ): Promise<RedactedSoR> {
    const scrubbedAt = new Date();

    // Pseudonymize actor identifiers
    const pseudonymizedReporterId = this.pseudonymize(
      'reporter',
      sor.user_id || 'unknown'
    );
    const pseudonymizedModeratorId = this.pseudonymize(
      'moderator',
      context.moderator_id || 'unknown'
    );
    const pseudonymizedDecisionId = this.pseudonymize(
      'decision',
      sor.decision_id
    );

    // Apply k-anonymity suppression
    const reportCountSuppression =
      context.report_count < this.config.kAnonymityThreshold;
    const jurisdictionCountSuppression =
      context.jurisdiction_count < this.config.kAnonymityThreshold;

    // Build aggregated data
    const aggregatedData = {
      report_count: reportCountSuppression
        ? ('suppressed' as const)
        : context.report_count,
      evidence_type: context.evidence_type,
      content_age: context.content_age,
      jurisdiction_count: jurisdictionCountSuppression
        ? ('suppressed' as const)
        : context.jurisdiction_count,
      has_trusted_flagger: context.has_trusted_flagger,
    };

    // Build scrubbing metadata
    const scrubbingMetadata = {
      scrubbed_at: scrubbedAt,
      scrubbing_version: SCRUBBING_VERSION,
      redacted_fields: REDACTED_FIELDS,
      environment_salt_version: this.config.saltVersion,
      aggregation_suppression: {
        report_count: reportCountSuppression,
        jurisdiction_count: jurisdictionCountSuppression,
        k: this.config.kAnonymityThreshold,
      },
    };

    // Construct redacted SoR
    const redactedSoR: RedactedSoR = {
      // Preserved non-PII fields
      decision_id: sor.decision_id,
      decision_ground: sor.decision_ground,
      legal_reference: sor.legal_reference,
      content_type: sor.content_type,
      automated_detection: sor.automated_detection,
      automated_decision: sor.automated_decision,
      territorial_scope: sor.territorial_scope,
      redress: sor.redress,
      transparency_db_id: sor.transparency_db_id,
      created_at: sor.created_at,

      // Aggregated/anonymized data
      aggregated_data: aggregatedData,

      // Pseudonymized identifiers
      pseudonymized_reporter_id: pseudonymizedReporterId,
      pseudonymized_moderator_id: pseudonymizedModeratorId,
      pseudonymized_decision_id: pseudonymizedDecisionId,

      // Scrubbing metadata
      scrubbing_metadata: scrubbingMetadata,
    };

    return redactedSoR;
  }

  /**
   * Pseudonymizes an identifier using HMAC-SHA256
   *
   * Uses environment-specific salt for deterministic but unlinkable pseudonyms
   *
   * Algorithm:
   * - HMAC-SHA256(key: salt, message: context + id)
   * - Truncate to 16 hex characters for readability
   * - Same input always produces same output within environment
   * - Different environments produce different pseudonyms
   */
  private pseudonymize(context: string, id: string): string {
    const salt = this.getSalt(context);
    const hmac = crypto.createHmac('sha256', salt);
    hmac.update(`${context}:${id}`);
    const hash = hmac.digest('hex');

    // Return first 16 characters for readability
    return hash.substring(0, 16);
  }

  /**
   * Gets environment-specific salt for pseudonymization
   *
   * Salt composition: ${environment}-${context}-${base_salt}
   */
  private getSalt(context: string): string {
    return `${this.config.environment}-${context}-${this.config.baseSalt}-v${this.config.saltVersion}`;
  }

  /**
   * Validates that a redacted SoR contains no PII
   *
   * Checks for presence of redacted fields and validates pseudonymization
   */
  validateRedaction(redactedSoR: RedactedSoR): {
    is_valid: boolean;
    violations: string[];
  } {
    const violations: string[] = [];

    // Check that redacted fields are not present
    const sorAsAny = redactedSoR as any;
    REDACTED_FIELDS.forEach((field) => {
      if (sorAsAny[field] !== undefined) {
        violations.push(`Redacted field "${field}" is still present`);
      }
    });

    // Validate pseudonymized IDs are not original values
    if (
      redactedSoR.pseudonymized_reporter_id.length < 16 ||
      redactedSoR.pseudonymized_moderator_id.length < 16 ||
      redactedSoR.pseudonymized_decision_id.length < 16
    ) {
      violations.push('Pseudonymized IDs appear to be insufficiently hashed');
    }

    // Validate scrubbing metadata is present
    if (!redactedSoR.scrubbing_metadata) {
      violations.push('Scrubbing metadata is missing');
    } else {
      if (!redactedSoR.scrubbing_metadata.scrubbed_at) {
        violations.push('Scrubbing timestamp is missing');
      }
      if (!redactedSoR.scrubbing_metadata.scrubbing_version) {
        violations.push('Scrubbing version is missing');
      }
      if (
        !redactedSoR.scrubbing_metadata.redacted_fields ||
        redactedSoR.scrubbing_metadata.redacted_fields.length === 0
      ) {
        violations.push('Redacted fields list is missing or empty');
      }
    }

    return {
      is_valid: violations.length === 0,
      violations,
    };
  }

  /**
   * Determines evidence type from evidence array
   */
  categorizeEvidenceType(
    evidenceUrls: string[]
  ): 'text' | 'image' | 'video' | 'mixed' {
    if (!evidenceUrls || evidenceUrls.length === 0) {
      return 'text';
    }

    const types = new Set<string>();
    evidenceUrls.forEach((url) => {
      if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
        types.add('image');
      } else if (url.match(/\.(mp4|webm|mov)$/i)) {
        types.add('video');
      } else {
        types.add('text');
      }
    });

    if (types.size > 1) {
      return 'mixed';
    }

    return types.has('image') ? 'image' : types.has('video') ? 'video' : 'text';
  }

  /**
   * Determines content age category
   */
  categorizeContentAge(createdAt: Date): 'new' | 'recent' | 'archived' {
    const now = new Date();
    const ageHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

    if (ageHours < 24) {
      return 'new';
    } else if (ageHours < 168) {
      // 7 days
      return 'recent';
    } else {
      return 'archived';
    }
  }

  /**
   * Gets scrubbing configuration
   */
  getConfig(): ScrubConfig {
    return { ...this.config };
  }

  /**
   * Updates scrubbing configuration
   */
  updateConfig(config: Partial<ScrubConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }
}

// Export singleton instance
export const piiScrubber = new PIIScrubber();

// Export class for testing with custom config
export { PIIScrubber as PIIScrubberClass };
