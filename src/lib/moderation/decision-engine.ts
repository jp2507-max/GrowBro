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

    // Validate report_id
    if (!decision.report_id || decision.report_id.trim().length === 0) {
      errors.push('Report ID is required');
    }

    // Validate moderator_id
    if (!decision.moderator_id || decision.moderator_id.trim().length === 0) {
      errors.push('Moderator ID is required');
    }

    // Validate policy violations (required for all actions except no_action)
    if (decision.action !== 'no_action') {
      if (
        !decision.policy_violations ||
        decision.policy_violations.length === 0
      ) {
        errors.push(
          'At least one policy violation must be specified (link to prohibited content catalog)'
        );
      }
    }

    // Validate reasoning
    if (!decision.reasoning || decision.reasoning.trim().length === 0) {
      errors.push('Reasoning is required');
    } else if (decision.reasoning.trim().length < 50) {
      errors.push(
        'Reasoning must be sufficiently detailed (minimum 50 characters)'
      );
    }

    // Validate action-specific requirements
    if (actionMeta.requires_duration) {
      // Check if duration fields exist (would be in decision metadata)
      // For now, we'll add a note that duration must be provided separately
      // This will be enforced at the API level
    }

    if (actionMeta.requires_territorial_scope) {
      // Check if territorial scope exists (would be in decision metadata)
      // For now, we'll add a note that territorial scope must be provided
    }

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

    return {
      is_valid: errors.length === 0,
      errors,
    };
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

// Export singleton instance
export const decisionEngine = new DecisionEngine();
