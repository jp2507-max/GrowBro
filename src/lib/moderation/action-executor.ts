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

import { DateTime } from 'luxon';

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

interface ExecutionRecord {
  decision_id: string;
  action: ModerationAction;
  content_id: string;
  user_id: string;
  reason_code: string;
  duration_days?: number;
  expires_at?: string;
  territorial_scope?: string[];
  executed_by: string;
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

      // Calculate expiration for time-boxed actions
      const expiresAt = input.duration_days
        ? DateTime.now().plus({ days: input.duration_days }).toJSDate()
        : undefined;

      // Perform the specific action (delegated)
      const executionResult = await this.performAction(input, expiresAt);

      if (!executionResult.success) {
        return { success: false, error: executionResult.error };
      }

      // Record execution and update decision status
      const execution = await this.recordExecution({
        decision_id: input.decision_id,
        action: input.action,
        content_id: input.content_id,
        user_id: input.user_id,
        reason_code: input.reason_code,
        duration_days: input.duration_days,
        expires_at: expiresAt?.toISOString(),
        territorial_scope: input.territorial_scope,
        executed_by: input.moderator_id,
        executed_at: new Date().toISOString(),
      });

      if (!execution || !execution.id) {
        return {
          success: false,
          error: 'Failed to record action execution',
        };
      }

      const updateOk = await this.updateDecisionStatus(input.decision_id);

      if (!updateOk) {
        return { success: false, error: 'Failed to update decision status' };
      }

      // Trigger notification (async, non-blocking)
      const notificationTriggered = await this.triggerNotification(input);

      return {
        success: true,
        execution_id: execution.id,
        notification_triggered: notificationTriggered,
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
   * Delegates action execution to specific handlers
   */
  private async performAction(
    input: ActionExecutionInput,
    expiresAt?: Date
  ): Promise<{ success: boolean; error?: string }> {
    switch (input.action) {
      case 'no_action':
        return this.executeNoAction(input);
      case 'quarantine':
        return this.executeQuarantine(input);
      case 'geo_block':
        return this.executeGeoBlock(input);
      case 'rate_limit':
        return this.executeRateLimit(input, expiresAt!);
      case 'shadow_ban':
        return this.executeShadowBan(input, expiresAt!);
      case 'suspend_user':
        return this.executeSuspension(input, expiresAt!);
      case 'remove':
        return this.executeRemoval(input);
      default:
        return {
          success: false,
          error: `Unknown action type: ${input.action}`,
        };
    }
  }

  /**
   * Insert execution record into DB and return the inserted row
   */
  private async recordExecution(record: ExecutionRecord): Promise<any> {
    const { data, error } = await supabase
      .from('action_executions')
      .insert(record)
      .select()
      .single();

    if (error) {
      console.error('recordExecution error:', error);
      return null;
    }

    return data;
  }

  /**
   * Update moderation_decisions status to executed
   */
  private async updateDecisionStatus(decisionId: string): Promise<boolean> {
    const { error } = await supabase
      .from('moderation_decisions')
      .update({
        status: 'executed',
        executed_at: new Date().toISOString(),
      })
      .eq('id', decisionId);

    if (error) {
      console.error('updateDecisionStatus error:', error);
      return false;
    }

    return true;
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
   * No action - mark as reviewed
   */
  private async executeNoAction(
    input: ActionExecutionInput
  ): Promise<{ success: boolean; error?: string }> {
    // Simply mark report as resolved
    const { error } = await supabase
      .from('content_reports')
      .update({
        status: 'resolved',
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.report_id);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  }

  /**
   * Quarantine - reduce content visibility
   */
  private async executeQuarantine(
    input: ActionExecutionInput
  ): Promise<{ success: boolean; error?: string }> {
    // Update content visibility flag
    const { error } = await supabase
      .from('posts')
      .update({
        quarantined: true,
        visibility: 'limited',
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.content_id);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  }

  /**
   * Geo-block - block content in specific territories
   */
  private async executeGeoBlock(
    input: ActionExecutionInput
  ): Promise<{ success: boolean; error?: string }> {
    // Insert geo-block records
    const geoBlockRecords = input.territorial_scope!.map((territory) => ({
      content_id: input.content_id,
      territory_code: territory,
      reason_code: input.reason_code,
      created_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('content_geo_blocks')
      .insert(geoBlockRecords);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  }

  /**
   * Rate limit - throttle user posting
   */
  private async executeRateLimit(
    input: ActionExecutionInput,
    expiresAt: Date
  ): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase.from('user_rate_limits').insert({
      user_id: input.user_id,
      reason_code: input.reason_code,
      expires_at: expiresAt.toISOString(),
      posts_per_hour: 1, // Restrictive rate
      created_at: new Date().toISOString(),
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  }

  /**
   * Shadow ban - make user posts invisible to others
   */
  private async executeShadowBan(
    input: ActionExecutionInput,
    expiresAt: Date
  ): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase.from('user_shadow_bans').insert({
      user_id: input.user_id,
      reason_code: input.reason_code,
      expires_at: expiresAt.toISOString(),
      created_at: new Date().toISOString(),
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  }

  /**
   * Suspend user - temporary account suspension
   */
  private async executeSuspension(
    input: ActionExecutionInput,
    expiresAt: Date
  ): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase.from('user_suspensions').insert({
      user_id: input.user_id,
      reason_code: input.reason_code,
      expires_at: expiresAt.toISOString(),
      suspended_at: new Date().toISOString(),
    });

    if (error) {
      return { success: false, error: error.message };
    }

    // Deactivate user account
    const { error: userError } = await supabase
      .from('users')
      .update({
        suspended: true,
        suspension_expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.user_id);

    if (userError) {
      return { success: false, error: userError.message };
    }

    return { success: true };
  }

  /**
   * Remove content - permanent deletion
   */
  private async executeRemoval(
    input: ActionExecutionInput
  ): Promise<{ success: boolean; error?: string }> {
    // Soft delete content
    const { error } = await supabase
      .from('posts')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: input.moderator_id,
        deletion_reason: input.reason_code,
      })
      .eq('id', input.content_id);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  }

  /**
   * Triggers user notification with Statement of Reasons
   *
   * Requirements: 3.3 (within 15 minutes)
   */
  private async triggerNotification(
    input: ActionExecutionInput
  ): Promise<boolean> {
    try {
      // Queue notification for delivery
      // This would integrate with the notification system
      // For now, we'll create a placeholder record
      const { error } = await supabase.from('moderation_notifications').insert({
        user_id: input.user_id,
        decision_id: input.decision_id,
        action: input.action,
        scheduled_for: DateTime.now()
          .plus({ minutes: 1 })
          .toJSDate()
          .toISOString(),
        status: 'pending',
        created_at: new Date().toISOString(),
      });

      return !error;
    } catch (error) {
      // Non-critical error, log but don't fail the execution
      console.error('Failed to trigger notification:', error);
      return false;
    }
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
