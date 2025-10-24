/**
 * Action Validator - Validates moderation action execution inputs
 */

import type { ModerationAction } from '@/types/moderation';

import type { ActionExecutionInput } from './types';

/**
 * Validates action execution input
 */
export function validateActionInput(input: ActionExecutionInput): {
  is_valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate required fields
  if (!input.decision_id) errors.push('Decision ID is required');
  if (!input.report_id) errors.push('Report ID is required');
  if (!input.content_id) errors.push('Content ID is required');
  if (!input.user_id) errors.push('User ID is required');
  if (!input.action) errors.push('Action is required');
  if (!input.reason_code) errors.push('Reason code is required');
  if (!input.moderator_id) errors.push('Moderator ID is required');

  // Validate duration for time-boxed actions
  const durationRequiredActions: ModerationAction[] = [
    'rate_limit',
    'shadow_ban',
    'suspend_user',
  ];
  if (durationRequiredActions.includes(input.action) && !input.duration_days) {
    errors.push(`Duration (days) is required for ${input.action}`);
  }
  if (
    durationRequiredActions.includes(input.action) &&
    input.duration_days &&
    !(typeof input.duration_days === 'number' && input.duration_days > 0)
  ) {
    errors.push(`Duration (days) must be greater than 0 for ${input.action}`);
  }

  // Validate territorial scope for geo_block
  if (
    input.action === 'geo_block' &&
    (!input.territorial_scope || input.territorial_scope.length === 0)
  ) {
    errors.push('Territorial scope is required for geo-blocking');
  }

  return {
    is_valid: errors.length === 0,
    errors,
  };
}
