/**
 * Task Creation Handler
 *
 * Orchestrates task creation from assessment action plans with error handling.
 * Handles batch task creation and tracks success/failure for analytics.
 *
 * Requirements:
 * - 3.4: Enable task creation from assessment results
 * - 9.1: Track task creation rates for analytics
 */

import { createTask } from '@/lib/task-manager';
import type { AssessmentResult } from '@/types/assessment';

import { trackTaskCreation } from './action-tracking';
import {
  createTasksFromActionPlan,
  type TaskCreationOptions,
} from './task-integration';

/**
 * Task creation result with success/failure details
 */
export type TaskCreationHandlerResult = {
  success: boolean;
  createdCount: number;
  failedCount: number;
  totalCount: number;
  createdTaskIds: string[];
  errors: { index: number; error: string }[];
};

/**
 * Extended task creation options with assessment result for tracking
 */
export type TaskCreationHandlerOptions = TaskCreationOptions & {
  assessment: AssessmentResult;
};

/**
 * Create tasks from assessment action plan with error handling
 *
 * @param options - Task creation options with assessment result
 * @returns Task creation result with success/failure details
 */
export async function handleTaskCreation(
  options: TaskCreationHandlerOptions
): Promise<TaskCreationHandlerResult> {
  const { plantId, assessmentId, assessment, timezone = 'UTC' } = options;

  // Generate task inputs from action plan
  const { taskInputs } = createTasksFromActionPlan(options);

  if (taskInputs.length === 0) {
    return {
      success: true,
      createdCount: 0,
      failedCount: 0,
      totalCount: 0,
      createdTaskIds: [],
      errors: [],
    };
  }

  // Execute batch task creation
  const createdTaskIds: string[] = [];
  const errors: { index: number; error: string }[] = [];

  for (let i = 0; i < taskInputs.length; i++) {
    const input = taskInputs[i];
    try {
      const task = await createTask(input);
      createdTaskIds.push(task.id);
    } catch (error) {
      errors.push({
        index: i,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  const createdCount = createdTaskIds.length;
  const failedCount = errors.length;
  const success = createdCount > 0;

  // Track task creation event for analytics
  trackTaskCreation(assessmentId, assessment, {
    taskCount: createdCount,
    plantId,
    timezone: timezone ?? 'UTC',
  });

  return {
    success,
    createdCount,
    failedCount,
    totalCount: taskInputs.length,
    createdTaskIds,
    errors,
  };
}

/**
 * Get user-friendly error message for task creation result
 *
 * @param result - Task creation result
 * @returns User-friendly message
 */
export function getTaskCreationMessage(
  result: TaskCreationHandlerResult
): string {
  if (result.totalCount === 0) {
    return 'No tasks to create from this action plan.';
  }

  if (result.createdCount === result.totalCount) {
    return `Successfully created ${result.createdCount} task${result.createdCount === 1 ? '' : 's'}!`;
  }

  if (result.createdCount === 0) {
    return 'Failed to create tasks. Please try again.';
  }

  // Partial success
  return `Created ${result.createdCount} of ${result.totalCount} tasks. ${result.failedCount} failed.`;
}
