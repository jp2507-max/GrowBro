/**
 * Security-specific feature flags
 * Wired to environment configuration and separate from main app feature flags
 */

import { Env } from '@env';

export interface SecurityFeatureFlags {
  /**
   * Enable encrypted storage using MMKV with encryption keys
   */
  enableEncryption: boolean;

  /**
   * Enable device integrity detection (jailbreak/root)
   */
  enableIntegrityDetection: boolean;

  /**
   * Enable high-assurance attestation (Play Integrity, App Attest)
   */
  enableAttestation: boolean;

  /**
   * Enable TLS certificate pinning
   */
  enableCertificatePinning: boolean;

  /**
   * Block sensitive actions on compromised devices (vs warn-only)
   */
  blockOnCompromise: boolean;

  /**
   * Enable threat monitoring and event logging
   */
  enableThreatMonitoring: boolean;

  /**
   * Sentry sampling rate for security events (0.0 to 1.0)
   */
  sentrySamplingRate: number;

  /**
   * Enable vulnerability scanning in CI
   */
  enableVulnerabilityScanning: boolean;

  /**
   * Enable automatic issue creation for critical/high vulnerabilities
   */
  enableAutoIssueCreation: boolean;

  /**
   * Bypass certificate pinning (dev/staging only)
   */
  bypassCertificatePinning: boolean;
}

/**
 * Get security feature flags from environment
 */
export function getSecurityFeatureFlags(): SecurityFeatureFlags {
  const appEnv = Env.APP_ENV || 'development';

  return {
    // Encryption is always enabled in production
    enableEncryption:
      Env.FEATURE_SECURITY_ENCRYPTION ?? appEnv === 'production',

    // Integrity detection enabled by default in production
    enableIntegrityDetection:
      Env.FEATURE_SECURITY_INTEGRITY_DETECTION ?? appEnv === 'production',

    // Attestation is opt-in (requires backend setup)
    enableAttestation: Env.FEATURE_SECURITY_ATTESTATION ?? false,

    // Certificate pinning enabled in production (requires EAS prebuild)
    enableCertificatePinning:
      Env.FEATURE_SECURITY_CERTIFICATE_PINNING ?? appEnv === 'production',

    // Block on compromise is opt-in (stricter security)
    blockOnCompromise: Env.FEATURE_SECURITY_BLOCK_ON_COMPROMISE ?? false,

    // Threat monitoring enabled by default
    enableThreatMonitoring: Env.FEATURE_SECURITY_THREAT_MONITORING ?? true,

    // Sentry sampling: 100% critical, 10% default
    sentrySamplingRate: Env.FEATURE_SECURITY_SENTRY_SAMPLING_RATE ?? 0.1,

    // Vulnerability scanning enabled in CI by default
    enableVulnerabilityScanning:
      Env.FEATURE_SECURITY_VULNERABILITY_SCANNING ?? true,

    // Auto issue creation enabled in production
    enableAutoIssueCreation:
      Env.FEATURE_SECURITY_AUTO_ISSUE_CREATION ?? appEnv === 'production',

    // Bypass pinning ONLY in development/staging
    bypassCertificatePinning:
      Env.FEATURE_SECURITY_BYPASS_PINNING ?? appEnv !== 'production',
  };
}

/**
 * Check if a specific security feature is enabled
 */
export function isSecurityFeatureEnabled(
  feature: keyof SecurityFeatureFlags
): boolean | number {
  const flags = getSecurityFeatureFlags();
  return flags[feature];
}

/**
 * Validate that production security requirements are met
 * Returns array of validation errors (empty if valid)
 */
export function validateProductionSecurityConfig(): string[] {
  const appEnv = Env.APP_ENV || 'development';
  if (appEnv !== 'production') {
    return []; // Skip validation for non-production
  }

  const flags = getSecurityFeatureFlags();
  const errors: string[] = [];

  if (!flags.enableEncryption) {
    errors.push('Encryption must be enabled in production');
  }

  if (!flags.enableIntegrityDetection) {
    errors.push('Integrity detection must be enabled in production');
  }

  if (flags.bypassCertificatePinning) {
    errors.push('Certificate pinning bypass must be disabled in production');
  }

  if (!flags.enableThreatMonitoring) {
    errors.push('Threat monitoring must be enabled in production');
  }

  return errors;
}

/**
 * Get a summary of current security feature flag status
 */
export function getSecurityFlagsSummary(): Record<string, boolean | number> {
  const flags = getSecurityFeatureFlags();
  return {
    encryption: flags.enableEncryption,
    integrity: flags.enableIntegrityDetection,
    attestation: flags.enableAttestation,
    pinning: flags.enableCertificatePinning,
    blockOnCompromise: flags.blockOnCompromise,
    threatMonitoring: flags.enableThreatMonitoring,
    sentrySampling: flags.sentrySamplingRate,
    vulnerabilityScanning: flags.enableVulnerabilityScanning,
    autoIssues: flags.enableAutoIssueCreation,
    bypassPinning: flags.bypassCertificatePinning,
  };
}
