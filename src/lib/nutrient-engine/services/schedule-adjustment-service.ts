/**
 * Schedule Adjustment Service
 *
 * Handles dynamic feeding schedule adjustments based on pH/EC deviations.
 * Proposes task modifications and applies bulk updates with user confirmation.
 *
 * Requirements: 5.5, 5.6
 */

import type { Database } from '@nozbe/watermelondb';
import { Q } from '@nozbe/watermelondb';

import { updateTask } from '@/lib/task-manager';
import type { TaskModel } from '@/lib/watermelon-models/task';
import type { Task } from '@/types/calendar';

import type { DeviationAlert } from '../types';

/**
 * Adjustment action types
 */
export const AdjustmentAction = {
  DILUTE: 'dilute',
  HOLD_FEED: 'hold_feed',
  ADJUST_PH_DOWN: 'adjust_ph_down',
  ADJUST_PH_UP: 'adjust_ph_up',
  REDUCE_EC: 'reduce_ec',
  INCREASE_EC: 'increase_ec',
} as const;

export type AdjustmentActionType =
  (typeof AdjustmentAction)[keyof typeof AdjustmentAction];

/**
 * Proposed task adjustment
 */
export type ProposedAdjustment = {
  taskId: string;
  taskTitle: string;
  currentDueDate: string;
  action: AdjustmentActionType;
  reason: string;
  newInstructions: string;
  severity: 'low' | 'medium' | 'high';
};

/**
 * Adjustment proposal result
 */
export type AdjustmentProposal = {
  alert: DeviationAlert;
  proposedAdjustments: ProposedAdjustment[];
  affectedTaskCount: number;
  canApply: boolean;
};

/**
 * Undo state for adjustment operations
 */
export type AdjustmentUndoState = {
  adjustmentId: string;
  operation: 'update';
  previousTasks: Task[];
  timestamp: number; // epoch ms
};

/**
 * Adjustment application result
 */
export type AdjustmentApplicationResult = {
  tasksUpdated: number;
  taskIds: string[];
  undo: AdjustmentUndoState;
  errors: { taskId: string; error: string }[];
};

/**
 * Propose schedule adjustments based on deviation alert
 *
 * Analyzes pH/EC deviations and suggests modifications to upcoming
 * feeding tasks (next 1-3 tasks). Returns proposals for user confirmation.
 *
 * @param database - WatermelonDB instance
 * @param options - Adjustment options (alert, plantId, maxTasks)
 * @returns Adjustment proposal with suggested changes
 */
export async function proposeAdjustments(
  database: Database,
  options: {
    alert: DeviationAlert;
    plantId: string;
    maxTasks?: number;
  }
): Promise<AdjustmentProposal> {
  const { alert, plantId, maxTasks = 3 } = options;
  const tasksCollection = database.get<TaskModel>('tasks');

  // Query upcoming feeding tasks for this plant
  const upcomingTasks = await tasksCollection
    .query(
      Q.where('plant_id', plantId),
      Q.where('status', 'pending'),
      Q.where('metadata', Q.like('%"type":"feeding"%')),
      Q.sortBy('due_at_utc', Q.asc),
      Q.take(maxTasks)
    )
    .fetch();

  // Determine adjustment action based on alert type
  const action = determineAdjustmentAction(alert);
  const severity = determineAdjustmentSeverity(alert);

  // Generate proposals for each task
  const proposedAdjustments: ProposedAdjustment[] = upcomingTasks.map(
    (task) => ({
      taskId: task.id,
      taskTitle: task.title,
      currentDueDate: task.dueAtLocal,
      action,
      reason: generateAdjustmentReason(alert, action),
      newInstructions: generateAdjustedInstructions(task, action, alert),
      severity,
    })
  );

  return {
    alert,
    proposedAdjustments,
    affectedTaskCount: proposedAdjustments.length,
    canApply: proposedAdjustments.length > 0,
  };
}

/**
 * Apply schedule adjustments after user confirmation
 *
 * Updates tasks with new instructions and creates undo state.
 * All updates are atomic within a single database transaction.
 *
 * @param database - WatermelonDB instance
 * @param proposals - Approved adjustment proposals
 * @returns Application result with task IDs and undo state
 */
export async function applyAdjustments(
  database: Database,
  proposals: ProposedAdjustment[]
): Promise<AdjustmentApplicationResult> {
  const result: AdjustmentApplicationResult = {
    tasksUpdated: 0,
    taskIds: [],
    undo: {
      adjustmentId: 'manual-adjustment',
      operation: 'update',
      previousTasks: [],
      timestamp: Date.now(),
    },
    errors: [],
  };

  const tasksCollection = database.get<TaskModel>('tasks');

  // Apply adjustments sequentially to avoid race conditions
  for (const proposal of proposals) {
    try {
      // Get current task for undo state
      const taskModel = await tasksCollection.find(proposal.taskId);
      const currentTask = modelToTask(taskModel);

      // Store previous state for undo
      result.undo.previousTasks.push({
        ...currentTask,
        id: proposal.taskId,
      });

      // Update task with new instructions
      await updateTask(proposal.taskId, {
        description: proposal.newInstructions,
        metadata: {
          ...currentTask.metadata,
          adjustedFor: proposal.action,
          adjustmentReason: proposal.reason,
          adjustmentTimestamp: Date.now(),
        },
      });

      result.tasksUpdated++;
      result.taskIds.push(proposal.taskId);
    } catch (error) {
      result.errors.push({
        taskId: proposal.taskId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return result;
}

/**
 * Revert schedule adjustments using undo state
 *
 * Restores tasks to their previous state before adjustment.
 *
 * @param database - WatermelonDB instance
 * @param undo - Undo state from adjustment application
 * @returns Number of tasks reverted
 */
export async function revertAdjustments(
  database: Database,
  undo: AdjustmentUndoState
): Promise<number> {
  let revertedCount = 0;

  for (const previousTask of undo.previousTasks) {
    try {
      await updateTask(previousTask.id, {
        description: previousTask.description,
        metadata: previousTask.metadata,
      });

      revertedCount++;
    } catch (error) {
      console.warn(`Failed to revert task ${previousTask.id}:`, error);
    }
  }

  return revertedCount;
}

/**
 * Determine adjustment action based on alert type
 */
function determineAdjustmentAction(
  alert: DeviationAlert
): AdjustmentActionType {
  switch (alert.type) {
    case 'ec_high':
      return AdjustmentAction.DILUTE;
    case 'ec_low':
      return AdjustmentAction.INCREASE_EC;
    case 'ph_high':
      return AdjustmentAction.ADJUST_PH_DOWN;
    case 'ph_low':
      return AdjustmentAction.ADJUST_PH_UP;
    default:
      return AdjustmentAction.HOLD_FEED;
  }
}

/**
 * Determine adjustment severity based on alert
 */
function determineAdjustmentSeverity(
  alert: DeviationAlert
): 'low' | 'medium' | 'high' {
  if (alert.severity === 'critical') return 'high';
  if (alert.severity === 'warning') return 'medium';
  return 'low';
}

/**
 * Generate human-readable adjustment reason
 */
function generateAdjustmentReason(
  alert: DeviationAlert,
  action: AdjustmentActionType
): string {
  const baseReason = alert.message;

  switch (action) {
    case AdjustmentAction.DILUTE:
      return `${baseReason}. Reducing nutrient concentration to bring EC into range.`;
    case AdjustmentAction.HOLD_FEED:
      return `${baseReason}. Skipping feeding to allow plants to recover.`;
    case AdjustmentAction.ADJUST_PH_DOWN:
      return `${baseReason}. Adding pH down to lower pH into target range.`;
    case AdjustmentAction.ADJUST_PH_UP:
      return `${baseReason}. Adding pH up to raise pH into target range.`;
    case AdjustmentAction.REDUCE_EC:
      return `${baseReason}. Reducing feed strength to lower EC.`;
    case AdjustmentAction.INCREASE_EC:
      return `${baseReason}. Increasing feed strength to raise EC.`;
    default:
      return baseReason;
  }
}

/**
 * Generate adjusted task instructions
 */
function generateAdjustedInstructions(
  task: TaskModel,
  action: AdjustmentActionType,
  alert: DeviationAlert
): string {
  const originalDescription = task.description || '';
  const adjustmentNote = `\n\n⚠️ ADJUSTED FEEDING\n${alert.message}\n\nAction: ${formatAction(action)}\n\nRecommendations:\n${alert.recommendations.map((r) => `• ${r}`).join('\n')}`;

  return originalDescription + adjustmentNote;
}

/**
 * Format action type for display
 */
function formatAction(action: AdjustmentActionType): string {
  switch (action) {
    case AdjustmentAction.DILUTE:
      return 'Dilute nutrient solution by 10-20%';
    case AdjustmentAction.HOLD_FEED:
      return 'Hold feeding for this cycle';
    case AdjustmentAction.ADJUST_PH_DOWN:
      return 'Add pH down solution';
    case AdjustmentAction.ADJUST_PH_UP:
      return 'Add pH up solution';
    case AdjustmentAction.REDUCE_EC:
      return 'Reduce feed strength by 20%';
    case AdjustmentAction.INCREASE_EC:
      return 'Increase feed strength by 10%';
    default:
      return 'Monitor and adjust as needed';
  }
}

/**
 * Convert TaskModel to Task type
 */
function modelToTask(model: TaskModel): Task {
  return {
    id: model.id,
    seriesId: model.seriesId,
    title: model.title,
    description: model.description,
    dueAtLocal: model.dueAtLocal,
    dueAtUtc: model.dueAtUtc,
    timezone: model.timezone,
    reminderAtLocal: model.reminderAtLocal,
    reminderAtUtc: model.reminderAtUtc,
    plantId: model.plantId,
    status: model.status,
    completedAt: model.completedAt?.toISOString(),
    metadata: model.metadata,
    createdAt: model.createdAt.toISOString(),
    updatedAt: model.updatedAt.toISOString(),
    deletedAt: model.deletedAt?.toISOString(),
  };
}
