/**
 * Enforcement Configuration - DSA Art. 23 Graduated Enforcement
 *
 * Defines escalation thresholds and suspension duration policies
 * for repeat offender enforcement.
 *
 * Requirements: 12.1, 12.2, 12.5
 */

import type { EscalationLevel } from '@/types/moderation';

// ============================================================================
// Types
// ============================================================================

export interface ViolationThresholds {
  warning: number; // Max violations before temporary suspension
  temporary_suspension: number; // Max violations before permanent ban
}

export interface SuspensionDurationPolicy {
  first_suspension_days: number;
  second_suspension_days: number;
  third_suspension_days: number;
  fourth_plus_action: 'permanent_ban' | 'extended_suspension';
  extended_suspension_days?: number;
}

export interface EnforcementPolicy {
  violation_type: string;
  thresholds: ViolationThresholds;
  suspension_duration: SuspensionDurationPolicy;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Default escalation thresholds for all violation types
 *
 * Graduated enforcement: warning → temporary_suspension → permanent_ban
 */
export const DEFAULT_THRESHOLDS: ViolationThresholds = {
  warning: 2, // 1-2 violations = warning
  temporary_suspension: 5, // 3-5 violations = temporary suspension
  // 6+ violations = permanent ban
};

/**
 * Default suspension duration policy
 *
 * Escalating suspension durations:
 * - First: 1 day
 * - Second: 7 days
 * - Third: 30 days
 * - Fourth+: Permanent ban
 */
export const DEFAULT_SUSPENSION_DURATION: SuspensionDurationPolicy = {
  first_suspension_days: 1,
  second_suspension_days: 7,
  third_suspension_days: 30,
  fourth_plus_action: 'permanent_ban',
};

/**
 * Violation type-specific enforcement policies
 *
 * Different violation types may have different thresholds and severity levels
 */
export const ENFORCEMENT_POLICIES: Record<string, EnforcementPolicy> = {
  // Critical violations - stricter thresholds
  illegal_content: {
    violation_type: 'illegal_content',
    severity: 'critical',
    thresholds: {
      warning: 0, // No warnings
      temporary_suspension: 1, // 1 violation = temporary suspension
      // 2+ violations = permanent ban
    },
    suspension_duration: {
      first_suspension_days: 7,
      second_suspension_days: 30,
      third_suspension_days: 90,
      fourth_plus_action: 'permanent_ban',
    },
  },

  csam: {
    violation_type: 'csam',
    severity: 'critical',
    thresholds: {
      warning: 0, // No warnings - immediate action
      temporary_suspension: 0, // No temporary suspension
      // 1+ violation = permanent ban
    },
    suspension_duration: {
      first_suspension_days: 0, // Immediate permanent ban
      second_suspension_days: 0,
      third_suspension_days: 0,
      fourth_plus_action: 'permanent_ban',
    },
  },

  hate_speech: {
    violation_type: 'hate_speech',
    severity: 'high',
    thresholds: {
      warning: 1, // 1 violation = warning
      temporary_suspension: 3, // 2-3 violations = temporary suspension
      // 4+ violations = permanent ban
    },
    suspension_duration: {
      first_suspension_days: 3,
      second_suspension_days: 14,
      third_suspension_days: 60,
      fourth_plus_action: 'permanent_ban',
    },
  },

  harassment: {
    violation_type: 'harassment',
    severity: 'high',
    thresholds: {
      warning: 1,
      temporary_suspension: 3,
    },
    suspension_duration: {
      first_suspension_days: 3,
      second_suspension_days: 14,
      third_suspension_days: 60,
      fourth_plus_action: 'permanent_ban',
    },
  },

  // Medium severity violations
  spam: {
    violation_type: 'spam',
    severity: 'medium',
    thresholds: {
      warning: 2,
      temporary_suspension: 5,
    },
    suspension_duration: {
      first_suspension_days: 1,
      second_suspension_days: 7,
      third_suspension_days: 30,
      fourth_plus_action: 'permanent_ban',
    },
  },

  misinformation: {
    violation_type: 'misinformation',
    severity: 'medium',
    thresholds: {
      warning: 2,
      temporary_suspension: 5,
    },
    suspension_duration: {
      first_suspension_days: 2,
      second_suspension_days: 7,
      third_suspension_days: 30,
      fourth_plus_action: 'permanent_ban',
    },
  },

  // Low severity violations
  inappropriate_content: {
    violation_type: 'inappropriate_content',
    severity: 'low',
    thresholds: {
      warning: 3,
      temporary_suspension: 7,
    },
    suspension_duration: {
      first_suspension_days: 1,
      second_suspension_days: 3,
      third_suspension_days: 7,
      fourth_plus_action: 'extended_suspension',
      extended_suspension_days: 30,
    },
  },

  off_topic: {
    violation_type: 'off_topic',
    severity: 'low',
    thresholds: {
      warning: 5,
      temporary_suspension: 10,
    },
    suspension_duration: {
      first_suspension_days: 1,
      second_suspension_days: 3,
      third_suspension_days: 7,
      fourth_plus_action: 'extended_suspension',
      extended_suspension_days: 14,
    },
  },
};

/**
 * Manifestly unfounded report thresholds
 *
 * DSA Art. 23 measures against misuse of reporting
 */
export const MANIFESTLY_UNFOUNDED_THRESHOLDS = {
  warning: 3, // 3+ unfounded reports = warning
  temporary_suspension: 5, // 5+ unfounded reports = temporary suspension
  permanent_ban: 10, // 10+ unfounded reports = permanent ban from reporting
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get enforcement policy for a violation type
 *
 * Falls back to default thresholds if no specific policy exists
 */
export function getEnforcementPolicy(violationType: string): EnforcementPolicy {
  return (
    ENFORCEMENT_POLICIES[violationType] || {
      violation_type: violationType,
      severity: 'medium',
      thresholds: DEFAULT_THRESHOLDS,
      suspension_duration: DEFAULT_SUSPENSION_DURATION,
    }
  );
}

/**
 * Calculate escalation level based on violation count
 */
export function calculateEscalationLevel(
  violationCount: number,
  violationType: string
): EscalationLevel {
  const policy = getEnforcementPolicy(violationType);

  if (violationCount <= policy.thresholds.warning) {
    return 'warning';
  }

  if (violationCount <= policy.thresholds.temporary_suspension) {
    return 'temporary_suspension';
  }

  return 'permanent_ban';
}

/**
 * Calculate suspension duration based on suspension count
 */
export function calculateSuspensionDuration(
  suspensionCount: number,
  violationType: string
): number | null {
  const policy = getEnforcementPolicy(violationType);
  const duration = policy.suspension_duration;

  switch (suspensionCount) {
    case 0:
      return duration.first_suspension_days;
    case 1:
      return duration.second_suspension_days;
    case 2:
      return duration.third_suspension_days;
    default:
      // 3+ suspensions
      if (duration.fourth_plus_action === 'permanent_ban') {
        return null; // null = permanent ban
      }
      return duration.extended_suspension_days || 30;
  }
}

/**
 * Check if violation type requires immediate permanent ban
 */
export function requiresImmediateBan(violationType: string): boolean {
  const policy = getEnforcementPolicy(violationType);
  return (
    policy.severity === 'critical' &&
    policy.thresholds.warning === 0 &&
    policy.thresholds.temporary_suspension === 0
  );
}

/**
 * Get manifestly unfounded action based on count
 */
export function getManifestlyUnfoundedAction(
  count: number
): 'none' | 'warning' | 'temporary_suspension' | 'permanent_ban' {
  if (count < MANIFESTLY_UNFOUNDED_THRESHOLDS.warning) {
    return 'none';
  }

  if (count < MANIFESTLY_UNFOUNDED_THRESHOLDS.temporary_suspension) {
    return 'warning';
  }

  if (count < MANIFESTLY_UNFOUNDED_THRESHOLDS.permanent_ban) {
    return 'temporary_suspension';
  }

  return 'permanent_ban';
}
