/**
 * Feature flags for community moderation system
 * All features default to disabled (ship dark) until compliance validation complete
 */

export const MODERATION_FEATURE_FLAGS = {
  /**
   * SoR Export to DSA Transparency Database (Art. 24(5))
   * Enable after: Commission DB API credentials configured, PII scrubbing golden tests passing,
   * legal review approval, DLQ monitoring configured
   */
  SOR_EXPORT_ENABLED:
    (process.env.FEATURE_SOR_EXPORT_ENABLED ?? 'false') === 'true',

  /**
   * Age Verification and Minor Protection (DSA Art. 28)
   * Enable after: DPIA approval, third-party provider contract signed,
   * privacy-preserving implementation tested, no-raw-ID storage verified
   */
  AGE_VERIFICATION_ENABLED:
    (process.env.FEATURE_AGE_VERIFICATION_ENABLED ?? 'false') === 'true',

  /**
   * Geo-blocking and Regional Content Restrictions
   * Enable after: IP geolocation accuracy validated (>95%), ePrivacy compliance verified,
   * appeal flow tested, legal review approval
   */
  GEO_BLOCKING_ENABLED:
    (process.env.FEATURE_GEO_BLOCKING_ENABLED ?? 'false') === 'true',

  /**
   * Trusted Flagger Priority Lane (DSA Art. 22)
   * Enable after: Certification criteria documented, priority queue SLA monitoring configured,
   * quality analytics operational, quarterly review workflow implemented
   */
  TRUSTED_FLAGGERS_ENABLED:
    (process.env.FEATURE_TRUSTED_FLAGGERS_ENABLED ?? 'false') === 'true',

  /**
   * Content Reporting System (DSA Art. 16)
   * Enable after: Two-track intake tested, field validation working,
   * duplicate detection operational, data minimization verified
   */
  CONTENT_REPORTING_ENABLED:
    (process.env.FEATURE_CONTENT_REPORTING_ENABLED ?? 'false') === 'true',

  /**
   * Moderation Queue and Decision Workflow (DSA Art. 17)
   * Enable after: SoR generation tested, policy catalog integrated,
   * graduated enforcement operational, audit trail verified
   */
  MODERATION_QUEUE_ENABLED:
    (process.env.FEATURE_MODERATION_QUEUE_ENABLED ?? 'false') === 'true',

  /**
   * Appeals System (DSA Art. 20 Internal Complaints)
   * Enable after: Conflict-of-interest prevention working, human review guaranteed,
   * appeal window enforcement tested, decision reversal operational
   */
  APPEALS_ENABLED: (process.env.FEATURE_APPEALS_ENABLED ?? 'false') === 'true',

  /**
   * ODS Integration (DSA Art. 21 Out-of-Court Dispute)
   * Enable after: Certified ODS body selected, API integration tested,
   * case data export working, outcome tracking operational
   */
  ODS_INTEGRATION_ENABLED:
    (process.env.FEATURE_ODS_INTEGRATION_ENABLED ?? 'false') === 'true',

  /**
   * Repeat Offender Detection (DSA Art. 23 Measures Against Misuse)
   * Enable after: Pattern detection tested, graduated enforcement working,
   * manifestly unfounded tracking operational, appeal path verified
   */
  REPEAT_OFFENDER_DETECTION_ENABLED:
    (process.env.FEATURE_REPEAT_OFFENDER_DETECTION_ENABLED ?? 'false') ===
    'true',

  /**
   * Transparency Reporting (DSA Art. 15 & 24)
   * Enable after: Metrics aggregation tested, report generation working,
   * structured export formats validated, authority access configured
   */
  TRANSPARENCY_REPORTING_ENABLED:
    (process.env.FEATURE_TRANSPARENCY_REPORTING_ENABLED ?? 'false') === 'true',
} as const;

/**
 * Check if a specific moderation feature is enabled
 */
export function isModerationFeatureEnabled(
  feature: keyof typeof MODERATION_FEATURE_FLAGS
): boolean {
  return MODERATION_FEATURE_FLAGS[feature];
}

/**
 * Get all enabled moderation features
 */
export function getEnabledModerationFeatures(): string[] {
  return Object.entries(MODERATION_FEATURE_FLAGS)
    .filter(([_, enabled]) => enabled)
    .map(([feature]) => feature);
}

/**
 * Get all disabled moderation features (for compliance checklist)
 */
export function getDisabledModerationFeatures(): string[] {
  return Object.entries(MODERATION_FEATURE_FLAGS)
    .filter(([_, enabled]) => !enabled)
    .map(([feature]) => feature);
}

/**
 * Feature flag status for monitoring and debugging
 */
export function getModerationFeatureFlagStatus(): Record<string, boolean> {
  return { ...MODERATION_FEATURE_FLAGS };
}
