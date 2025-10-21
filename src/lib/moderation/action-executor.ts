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

import { supabase } from '../supabase';
import { validateActionInput } from './action-validator';
import type {
  ActionExecutionInput,
  ActionExecutionResult,
  ActionExecutionRow,
} from './types';

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
      const validation = validateActionInput(input);
      if (!validation.is_valid) {
        return {
          success: false,
          error: `Action execution failed: ${validation.errors.join(', ')}`,
        };
      }

      // Execute action via RPC (atomic transaction)
      const { data, error } = await supabase.rpc('execute_moderation_action', {
        p_decision_id: input.decision_id,
        p_executed_by: input.moderator_id,
      });

      if (error) {
        return {
          success: false,
          error: `RPC execution failed: ${error.message}`,
        };
      }

      // Parse RPC response (JSONB)
      if (
        !data ||
        typeof data !== 'object' ||
        !('id' in data) ||
        !('decision_id' in data)
      ) {
        return { success: false, error: 'Invalid RPC response structure' };
      }
      const result = data as ActionExecutionRow;

      // RPC returns execution details on success
      return {
        success: true,
        execution_id: result.id,
        notification_triggered: result.notification_enqueued ?? false,
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
}

// Export singleton instance
export const actionExecutor = new ActionExecutor();
