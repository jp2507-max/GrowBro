/**
 * Shared types for moderation modules
 */

import type { ModerationAction } from '@/types/moderation';

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
  notification_enqueued?: boolean;
}
