/**
 * Statement of Reasons Generator - DSA Art. 17 compliance
 *
 * Generates complete Statement of Reasons with all mandatory fields:
 * - Decision ground (illegal content vs Terms & Conditions)
 * - Facts and circumstances
 * - Legal reference (if illegal)
 * - Automation disclosure (detection and decision)
 * - Territorial scope
 * - Redress options
 *
 * Requirements: 3.3
 */

import type {
  ContentType,
  DecisionGround,
  ModerationAction,
  RedressOption,
  StatementOfReasons,
} from '@/types/moderation';

import { supabase } from '../supabase';

// ============================================================================
// Types
// ============================================================================

export interface SoRGenerationInput {
  decision_id: string;
  decision_ground: DecisionGround;
  legal_reference?: string;
  content_type: ContentType;
  action: ModerationAction;
  policy_violations: string[];
  reasoning: string;
  automated_detection: boolean;
  automated_decision: boolean;
  territorial_scope?: string[];
  user_id: string;
}

export interface SoRGenerationResult {
  success: boolean;
  statement_of_reasons?: StatementOfReasons;
  error?: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default redress options per action severity
 *
 * All users get internal_appeal (DSA Art. 20)
 * Severe actions also offer ODS (DSA Art. 21)
 * All can pursue court action
 */
const DEFAULT_REDRESS_OPTIONS: Record<ModerationAction, RedressOption[]> = {
  no_action: ['court'],
  quarantine: ['internal_appeal', 'ods', 'court'],
  geo_block: ['internal_appeal', 'ods', 'court'],
  rate_limit: ['internal_appeal', 'ods', 'court'],
  shadow_ban: ['internal_appeal', 'ods', 'court'],
  suspend_user: ['internal_appeal', 'ods', 'court'],
  remove: ['internal_appeal', 'ods', 'court'],
};

// ============================================================================
// Statement of Reasons Generator
// ============================================================================

export class SoRGenerator {
  /**
   * Generates a complete Statement of Reasons compliant with DSA Art. 17
   *
   * Requirements: 3.3
   */
  async generateStatementOfReasons(
    input: SoRGenerationInput
  ): Promise<SoRGenerationResult> {
    try {
      // Validate input
      const validation = this.validateInput(input);
      if (!validation.is_valid) {
        return {
          success: false,
          error: `SoR generation failed: ${validation.errors.join(', ')}`,
        };
      }

      // Build facts and circumstances from reasoning and policy violations
      const factsAndCircumstances = this.buildFactsAndCircumstances(
        input.reasoning,
        input.policy_violations,
        input.action
      );

      // Determine redress options
      const redress = DEFAULT_REDRESS_OPTIONS[input.action];

      // Create Statement of Reasons
      const sor: Omit<
        StatementOfReasons,
        'id' | 'created_at' | 'updated_at' | 'deleted_at'
      > = {
        decision_id: input.decision_id,
        decision_ground: input.decision_ground,
        legal_reference: input.legal_reference,
        content_type: input.content_type,
        facts_and_circumstances: factsAndCircumstances,
        automated_detection: input.automated_detection,
        automated_decision: input.automated_decision,
        territorial_scope: input.territorial_scope,
        redress,
        transparency_db_id: undefined, // Will be populated after submission
        transparency_db_submitted_at: undefined,
        user_id: input.user_id,
      };

      // Insert into database
      const { data, error } = await supabase
        .from('statements_of_reasons')
        .insert(sor)
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: `Failed to store Statement of Reasons: ${error.message}`,
        };
      }

      return {
        success: true,
        statement_of_reasons: data as StatementOfReasons,
      };
    } catch (error) {
      return {
        success: false,
        error: `SoR generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Validates SoR generation input
   *
   * Requirements: 3.3
   */
  private validateInput(input: SoRGenerationInput): {
    is_valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Validate decision_id
    if (!input.decision_id || input.decision_id.trim().length === 0) {
      errors.push('Decision ID is required');
    }

    // Validate decision_ground
    if (!input.decision_ground) {
      errors.push('Decision ground (illegal or terms) is required');
    }

    // Validate legal_reference for illegal content
    if (input.decision_ground === 'illegal' && !input.legal_reference) {
      errors.push(
        'Legal reference is required for illegal content decisions (e.g., "DE StGB §130")'
      );
    }

    // Validate content_type
    if (!input.content_type) {
      errors.push('Content type is required');
    }

    // Validate reasoning
    if (!input.reasoning || input.reasoning.trim().length === 0) {
      errors.push('Reasoning is required');
    } else if (input.reasoning.trim().length < 50) {
      errors.push(
        'Reasoning must be sufficiently detailed (minimum 50 characters)'
      );
    }

    // Validate policy violations for actions other than no_action
    if (
      input.action !== 'no_action' &&
      (!input.policy_violations || input.policy_violations.length === 0)
    ) {
      errors.push('Policy violations are required for restrictive actions');
    }

    // Validate territorial_scope for geo_block
    if (
      input.action === 'geo_block' &&
      (!input.territorial_scope || input.territorial_scope.length === 0)
    ) {
      errors.push(
        'Territorial scope is required for geo-blocking actions (e.g., ["DE", "FR"])'
      );
    }

    // Validate user_id
    if (!input.user_id || input.user_id.trim().length === 0) {
      errors.push('User ID is required');
    }

    return {
      is_valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Builds comprehensive facts and circumstances text
   *
   * Combines moderator reasoning with policy violation context
   *
   * Requirements: 3.3
   */
  private buildFactsAndCircumstances(
    reasoning: string,
    policyViolations: string[],
    action: ModerationAction
  ): string {
    let facts = `The content was reviewed and the following determination was made:\n\n`;

    // Add moderator reasoning
    facts += `${reasoning}\n\n`;

    // Add policy violations
    if (policyViolations.length > 0) {
      facts += `The content violates the following policies:\n`;
      policyViolations.forEach((violation) => {
        facts += `- ${violation}\n`;
      });
      facts += `\n`;
    }

    // Add action description
    const actionDescriptions: Record<ModerationAction, string> = {
      no_action:
        'After review, no policy violation was found and no action was taken.',
      quarantine:
        'The content visibility has been reduced to limit its reach while remaining accessible.',
      geo_block:
        'The content has been blocked in specific territories where it violates local laws.',
      rate_limit:
        'The user has been rate-limited to prevent further violations while maintaining account access.',
      shadow_ban:
        'The user has been temporarily shadow-banned (posts invisible to others) for a specified duration.',
      suspend_user:
        'The user account has been temporarily suspended due to serious or repeated violations.',
      remove:
        'The content has been permanently removed from the platform due to severe policy violations.',
    };

    facts += `Action taken: ${actionDescriptions[action]}`;

    return facts;
  }

  /**
   * Gets user-friendly description of decision ground
   *
   * Requirements: 3.3
   */
  getDecisionGroundDescription(
    ground: DecisionGround,
    legalReference?: string
  ): string {
    if (ground === 'illegal') {
      return `This content was removed because it violates ${legalReference || 'applicable law'}.`;
    }
    return 'This content was removed because it violates our Terms & Conditions and Community Guidelines.';
  }

  /**
   * Gets user-friendly description of redress options
   *
   * Requirements: 3.3
   */
  getRedressDescription(redress: RedressOption[]): string {
    const descriptions: string[] = [];

    if (redress.includes('internal_appeal')) {
      descriptions.push(
        'You may appeal this decision through our internal complaint handling system within 14 days for content removal or 30 days for account actions (DSA Art. 20).'
      );
    }

    if (redress.includes('ods')) {
      descriptions.push(
        'If your internal appeal is unsuccessful, you may escalate to a certified out-of-court dispute settlement body (DSA Art. 21).'
      );
    }

    if (redress.includes('court')) {
      descriptions.push(
        'You have the right to pursue this matter through judicial proceedings.'
      );
    }

    return descriptions.join(' ');
  }

  /**
   * Gets automation disclosure text for user-facing SoR
   *
   * Requirements: 3.3 (DSA Art. 17(3)(c))
   */
  getAutomationDisclosure(
    automatedDetection: boolean,
    automatedDecision: boolean
  ): string {
    if (automatedDetection && automatedDecision) {
      return 'This decision was made using fully automated means. The content was detected and the decision was made by automated systems without human review.';
    }

    if (automatedDetection && !automatedDecision) {
      return 'This content was initially flagged by automated detection systems, but the final decision was made by a human moderator after review.';
    }

    if (!automatedDetection && automatedDecision) {
      return 'This content was reported by a user, but the decision was made by automated systems based on policy rules.';
    }

    return 'This decision was made by a human moderator after manual review of the reported content.';
  }
}

// Export singleton instance
export const sorGenerator = new SoRGenerator();
