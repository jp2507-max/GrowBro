/**
 * Decision Engine - Graduated enforcement and policy validation
 *
 * Implements DSA-compliant decision-making with:
 * - Graduated action options (no action → removal)
 * - Policy violation requirement enforcement
 * - Supervisor approval logic for legal violations
 * - Action validation with required fields checking
 *
 * Requirements: 3.1, 3.2
 */

import type {
  ModerationAction,
  ModerationDecisionInput,
} from '@/types/moderation';

// ============================================================================
// Types
// ============================================================================

export interface DecisionValidationResult {
  is_valid: boolean;
  errors: string[];
}

export interface ActionMetadata {
  requires_duration: boolean;
  requires_territorial_scope: boolean;
  requires_supervisor_approval_if_illegal: boolean;
  max_duration_days?: number;
  description: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Graduated enforcement action metadata
 *
 * Actions ordered from least to most severe:
 * 1. no_action - Report reviewed, no violation found
 * 2. quarantine - Reduce visibility/reach (soft moderation)
 * 3. geo_block - Block in specific territories
 * 4. rate_limit - Throttle user's posting rate
 * 5. shadow_ban - User invisible to others, time-boxed
 * 6. suspend_user - Temporary account suspension
 * 7. remove - Permanent content removal
 */
export const ACTION_METADATA: Record<ModerationAction, ActionMetadata> = {
  no_action: {
    requires_duration: false,
    requires_territorial_scope: false,
    requires_supervisor_approval_if_illegal: false,
    description: 'No policy violation found, no action taken',
  },
  quarantine: {
    requires_duration: false,
    requires_territorial_scope: false,
    requires_supervisor_approval_if_illegal: false,
    description: 'Reduce content visibility and reach (soft moderation)',
  },
  geo_block: {
    requires_duration: false,
    requires_territorial_scope: true,
    requires_supervisor_approval_if_illegal: true,
    description: 'Block content in specific territories',
  },
  rate_limit: {
    requires_duration: true,
    requires_territorial_scope: false,
    requires_supervisor_approval_if_illegal: false,
    max_duration_days: 30,
    description: 'Throttle user posting rate for specified duration',
  },
  shadow_ban: {
    requires_duration: true,
    requires_territorial_scope: false,
    requires_supervisor_approval_if_illegal: false,
    max_duration_days: 14,
    description:
      'User posts invisible to others for specified duration (time-boxed)',
  },
  suspend_user: {
    requires_duration: true,
    requires_territorial_scope: false,
    requires_supervisor_approval_if_illegal: true,
    max_duration_days: 90,
    description: 'Temporary account suspension',
  },
  remove: {
    requires_duration: false,
    requires_territorial_scope: false,
    requires_supervisor_approval_if_illegal: true,
    description: 'Permanent content removal',
  },
};

// ============================================================================
// Decision Engine
// ============================================================================

export class DecisionEngine {
  /**
   * Validates a moderation decision input
   *
   * Checks:
   * - Required fields are present
   * - Policy violations are specified (except for no_action)
   * - Duration requirements are met
   * - Territorial scope requirements are met
   * - Supervisor approval requirements are met
   *
   * Requirements: 3.1, 3.2
   */
  validateDecision(
    decision: ModerationDecisionInput,
    reportType: 'illegal' | 'policy_violation'
  ): DecisionValidationResult {
    const errors: string[] = [];
    const actionMeta = ACTION_METADATA[decision.action];

    this._validateRequiredFields(decision, errors);
    this._validatePolicyViolations(decision, errors);
    this._validateReasoning(decision, errors);

    if (actionMeta.requires_duration)
      this._validateDuration(decision, actionMeta, errors);
    if (actionMeta.requires_territorial_scope)
      this._validateTerritorialScope(decision, errors);

    // Validate supervisor approval requirement for illegal content
    if (
      reportType === 'illegal' &&
      actionMeta.requires_supervisor_approval_if_illegal &&
      !decision.requires_supervisor_approval
    ) {
      errors.push(
        `Action "${decision.action}" for illegal content requires supervisor approval`
      );
    }

    return { is_valid: errors.length === 0, errors };
  }

  // Helper validators split out to reduce method length
  private _validateRequiredFields(
    decision: ModerationDecisionInput,
    errors: string[]
  ): void {
    if (!decision.report_id || decision.report_id.trim().length === 0)
      errors.push('Report ID is required');
    if (!decision.moderator_id || decision.moderator_id.trim().length === 0)
      errors.push('Moderator ID is required');
  }

  private _validatePolicyViolations(
    decision: ModerationDecisionInput,
    errors: string[]
  ): void {
    if (decision.action === 'no_action') return;
    if (
      !decision.policy_violations ||
      decision.policy_violations.length === 0
    ) {
      errors.push(
        'At least one policy violation must be specified (link to prohibited content catalog)'
      );
    }
  }

  private _validateReasoning(
    decision: ModerationDecisionInput,
    errors: string[]
  ): void {
    if (!decision.reasoning || decision.reasoning.trim().length === 0) {
      errors.push('Reasoning is required');
    } else if (decision.reasoning.trim().length < 50) {
      errors.push(
        'Reasoning must be sufficiently detailed (minimum 50 characters)'
      );
    }
  }

  private _validateDuration(
    decision: ModerationDecisionInput,
    actionMeta: ActionMetadata,
    errors: string[]
  ): void {
    if (!decision.metadata?.duration) {
      errors.push(
        `Action "${decision.action}" requires a duration to be specified`
      );
      return;
    }

    const duration = decision.metadata.duration;
    if (typeof duration === 'string') {
      if (!/^P/.test(duration)) {
        errors.push(
          "Duration must be a valid ISO duration string (starting with 'P') or a structured duration object"
        );
      }
      return;
    }

    if (typeof duration === 'object') {
      if (typeof duration.value !== 'number' || duration.value <= 0)
        errors.push('Duration value must be a positive number');
      if (!duration.unit || typeof duration.unit !== 'string')
        errors.push('Duration unit must be a non-empty string');

      if (
        actionMeta.max_duration_days &&
        typeof duration.value === 'number' &&
        typeof duration.unit === 'string'
      ) {
        const valueInDays = convertToDays(duration.value, duration.unit);
        if (valueInDays > actionMeta.max_duration_days) {
          errors.push(
            `Duration cannot exceed ${actionMeta.max_duration_days} days for action "${decision.action}"`
          );
        }
      }
      return;
    }

    errors.push(
      'Duration must be either an ISO duration string or a structured duration object'
    );
  }

  private _validateTerritorialScope(
    decision: ModerationDecisionInput,
    errors: string[]
  ): void {
    if (!decision.metadata?.territorial_scope) {
      errors.push(
        `Action "${decision.action}" requires a territorial scope to be specified`
      );
      return;
    }

    const scope = decision.metadata.territorial_scope;
    if (typeof scope === 'string') {
      if (scope.trim().length === 0)
        errors.push('Territorial scope cannot be empty');
      return;
    }

    if (Array.isArray(scope)) {
      if (scope.length === 0)
        errors.push('Territorial scope array cannot be empty');
      const hasEmptyScope = scope.some((s) => !s || s.trim().length === 0);
      if (hasEmptyScope)
        errors.push('Territorial scope array cannot contain empty values');
      return;
    }

    errors.push('Territorial scope must be a string or array of strings');
  }

  /**
   * Determines if an action requires supervisor approval
   *
   * Requirements: 3.2
   */
  requiresSupervisorApproval(
    action: ModerationAction,
    reportType: 'illegal' | 'policy_violation'
  ): boolean {
    const actionMeta = ACTION_METADATA[action];

    // Legal violations with severe actions require supervisor approval
    if (reportType === 'illegal') {
      return actionMeta.requires_supervisor_approval_if_illegal;
    }

    return false;
  }

  /**
   * Gets action severity level (0-6, higher = more severe)
   *
   * Used for graduated enforcement escalation
   */
  getActionSeverity(action: ModerationAction): number {
    const severityOrder: ModerationAction[] = [
      'no_action',
      'quarantine',
      'geo_block',
      'rate_limit',
      'shadow_ban',
      'suspend_user',
      'remove',
    ];

    return severityOrder.indexOf(action);
  }

  /**
   * Suggests next escalation level for repeat offenders
   *
   * Requirements: 3.1
   */
  getEscalatedAction(
    currentAction: ModerationAction,
    violationCount: number
  ): ModerationAction {
    const currentSeverity = this.getActionSeverity(currentAction);

    // First offense: quarantine or appropriate initial action
    if (violationCount === 1) {
      return currentAction;
    }

    // Second offense: escalate one level
    if (violationCount === 2 && currentSeverity < 3) {
      return 'rate_limit';
    }

    // Third offense: escalate to shadow_ban
    if (violationCount === 3 && currentSeverity < 4) {
      return 'shadow_ban';
    }

    // Fourth+ offense: suspension
    if (violationCount >= 4 && currentSeverity < 5) {
      return 'suspend_user';
    }

    // Severe violations: immediate removal
    return 'remove';
  }

  /**
   * Validates policy violation IDs against prohibited content catalog
   *
   * Requirements: 3.2
   */
  async validatePolicyViolations(
    policyViolationIds: string[]
  ): Promise<{ valid: boolean; invalid_ids: string[] }> {
    // TODO: Implement actual validation against policy catalog table
    // For now, we'll accept any non-empty string as valid
    const invalidIds = policyViolationIds.filter(
      (id) => !id || id.trim().length === 0
    );

    return {
      valid: invalidIds.length === 0,
      invalid_ids: invalidIds,
    };
  }

  /**
   * Gets human-readable description of an action
   *
   * Requirements: 3.1
   */
  getActionDescription(action: ModerationAction): string {
    return ACTION_METADATA[action].description;
  }

  /**
   * Checks if an action requires additional metadata
   *
   * Requirements: 3.1
   */
  getActionRequirements(action: ModerationAction): {
    requires_duration: boolean;
    requires_territorial_scope: boolean;
    max_duration_days?: number;
  } {
    const meta = ACTION_METADATA[action];
    return {
      requires_duration: meta.requires_duration,
      requires_territorial_scope: meta.requires_territorial_scope,
      max_duration_days: meta.max_duration_days,
    };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Converts a duration value and unit to days for validation
 */
function convertToDays(value: number, unit: string): number {
  const normalizedUnit = unit.toLowerCase().trim();

  switch (normalizedUnit) {
    case 'days':
    case 'day':
    case 'd':
      return value;
    case 'weeks':
    case 'week':
    case 'w':
      return value * 7;
    case 'months':
    case 'month':
    case 'm':
      return value * 30; // Approximate
    case 'years':
    case 'year':
    case 'y':
      return value * 365; // Approximate
    case 'hours':
    case 'hour':
    case 'h':
      return value / 24;
    case 'minutes':
    case 'minute':
    case 'min':
      return value / (24 * 60);
    default:
      // Unknown unit, assume days
      return value;
  }
}

// Export singleton instance
export const decisionEngine = new DecisionEngine();
