/**
 * Action Executor - Graduated enforcement implementation
 *
 * Executes moderation actions with:
 * - Content actions (quarantine, geo_block, remove)
 * - User actions (rate_limit, shadow_ban, suspension)
 * - Duration tracking for time-boxed actions
 * - Automatic notification triggering
 * - Audit trail creation
 *
 * Requirements: 3.3
 */

import { randomUUID } from 'expo-crypto';

import type { ModerationAction } from '@/types/moderation';

import { supabase } from '../supabase';

// ============================================================================
// Types
// ============================================================================

export interface ActionExecutionInput {
  decision_id: string;
  report_id: string;
  content_id: string;
  user_id: string;
  action: ModerationAction;
  reason_code: string;
  duration_days?: number;
  territorial_scope?: string[];
  moderator_id: string;
}

export interface ActionExecutionResult {
  success: boolean;
  execution_id?: string;
  error?: string;
  notification_triggered?: boolean;
}

export interface ActionExecutionRow {
  id: string;
  decision_id: string;
  executed_at: string;
}

// ============================================================================
// Action Executor
// ============================================================================

export class ActionExecutor {
  /**
   * Executes a moderation action and triggers notifications
   *
   * Requirements: 3.3
   */
  async executeAction(
    input: ActionExecutionInput
  ): Promise<ActionExecutionResult> {
    try {
      // Validate input
      const validation = this.validateInput(input);
      if (!validation.is_valid) {
        return {
          success: false,
          error: `Action execution failed: ${validation.errors.join(', ')}`,
        };
      }

      // Generate idempotency key for safe retries
      const idempotencyKey = randomUUID();

      // Execute action via RPC (atomic transaction)
      const { data, error } = await supabase.rpc('execute_moderation_action', {
        p_decision_id: input.decision_id,
        p_idempotency_key: idempotencyKey,
        p_executed_by: input.moderator_id,
      });

      if (error) {
        return {
          success: false,
          error: `RPC execution failed: ${error.message}`,
        };
      }

      // Parse RPC response (JSONB)
      const result: ActionExecutionRow = data as ActionExecutionRow;

      // RPC returns execution details on success
      return {
        success: true,
        execution_id: result.id,
        notification_triggered: true, // RPC always queues notification
      };
    } catch (error) {
      return {
        success: false,
        error: `Action execution failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      };
    }
  }

  /**
   * Validates action execution input
   */
  private validateInput(input: ActionExecutionInput): {
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
    if (
      durationRequiredActions.includes(input.action) &&
      !input.duration_days
    ) {
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

  /**
   * Gets action execution status
   */
  async getExecutionStatus(executionId: string): Promise<{
    executed: boolean;
    expires_at?: Date;
    active: boolean;
  }> {
    const { data, error } = await supabase
      .from('action_executions')
      .select('executed_at, expires_at')
      .eq('id', executionId)
      .single();

    if (error || !data) {
      return { executed: false, active: false };
    }

    const expiresAt = data.expires_at ? new Date(data.expires_at) : undefined;
    const active = expiresAt ? expiresAt > new Date() : true;

    return {
      executed: true,
      expires_at: expiresAt,
      active,
    };
  }
}

// Export singleton instance
export const actionExecutor = new ActionExecutor();
