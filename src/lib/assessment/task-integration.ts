/**
 * Task Integration Module
 *
 * Handles creation of tasks from assessment action plans with prefilled details.
 * Integrates with existing calendar system for seamless task scheduling.
 *
 * Requirements:
 * - 3.4: Enable task creation from assessment results with prefilled details
 * - 9.2: Track task creation rates for analytics
 */

import { DateTime } from 'luxon';

import type { CreateTaskInput } from '@/lib/task-manager';
import type {
  AssessmentActionPlan,
  AssessmentActionStep,
  AssessmentTaskTemplate,
} from '@/types/assessment';
import type { TaskMetadata } from '@/types/calendar';

/**
 * Task creation options
 */
export type TaskCreationOptions = {
  plan: AssessmentActionPlan;
  plantId: string;
  assessmentId: string;
  classId: string;
  timezone?: string;
};

/**
 * Task creation result
 */
export type TaskCreationResult = {
  taskInputs: CreateTaskInput[];
  metadata: {
    assessmentId: string;
    classId: string;
    createdCount: number;
    timestamp: number;
  };
};

/**
 * Task Integration Service
 *
 * Converts action plan steps to task creation inputs for the calendar system.
 */
export class TaskIntegrationService {
  /**
   * Create task inputs from action plan
   *
   * @param options - Task creation options
   * @returns Task creation result with inputs and metadata
   */
  createTasksFromPlan(options: TaskCreationOptions): TaskCreationResult {
    const { plan, plantId, assessmentId, classId, timezone = 'UTC' } = options;
    const taskInputs: CreateTaskInput[] = [];

    // Process immediate steps (0-24 hours)
    for (const step of plan.immediateSteps) {
      if (step.taskTemplate) {
        const input = this.createTaskInput({
          step,
          plantId,
          assessmentId,
          timezone,
          daysFromNow: 0,
        });
        taskInputs.push(input);
      }
    }

    // Process short-term actions (24-48 hours)
    for (const step of plan.shortTermActions) {
      if (step.taskTemplate) {
        const input = this.createTaskInput({
          step,
          plantId,
          assessmentId,
          timezone,
          daysFromNow: 1,
        });
        taskInputs.push(input);
      }
    }

    return {
      taskInputs,
      metadata: {
        assessmentId,
        classId,
        createdCount: taskInputs.length,
        timestamp: Date.now(),
      },
    };
  }

  /**
   * Create a single task input from an action step
   */
  private createTaskInput(options: {
    step: AssessmentActionStep;
    plantId: string;
    assessmentId: string;
    timezone: string;
    daysFromNow: number;
  }): CreateTaskInput {
    const { step, plantId, assessmentId, timezone, daysFromNow } = options;
    const template = step.taskTemplate!;

    // Calculate due date
    const now = DateTime.now().setZone(timezone);
    const dueDate = now.plus({ days: daysFromNow, hours: 8 }); // Default to 8 AM
    const dueAtLocal = dueDate.toISO();

    if (!dueAtLocal) {
      throw new Error('Failed to generate due date ISO string');
    }

    // Build metadata with assessment tracking
    const metadata: TaskMetadata = {
      ...template.fields,
      assessmentId,
      generatedFromAssessment: true,
      priority: step.priority,
    };

    return {
      title: template.name,
      description: template.description ?? step.description,
      timezone,
      dueAtLocal,
      plantId,
      metadata,
    };
  }

  /**
   * Extract task templates from action plan
   *
   * @param plan - Action plan
   * @returns Array of task templates with step context
   */
  extractTaskTemplates(plan: AssessmentActionPlan): {
    template: AssessmentTaskTemplate;
    step: AssessmentActionStep;
    timeframe: string;
  }[] {
    const templates: {
      template: AssessmentTaskTemplate;
      step: AssessmentActionStep;
      timeframe: string;
    }[] = [];

    for (const step of plan.immediateSteps) {
      if (step.taskTemplate) {
        templates.push({
          template: step.taskTemplate,
          step,
          timeframe: step.timeframe,
        });
      }
    }

    for (const step of plan.shortTermActions) {
      if (step.taskTemplate) {
        templates.push({
          template: step.taskTemplate,
          step,
          timeframe: step.timeframe,
        });
      }
    }

    return templates;
  }

  /**
   * Count tasks that can be created from action plan
   *
   * @param plan - Action plan
   * @returns Number of tasks with templates
   */
  countCreatableTasks(plan: AssessmentActionPlan): number {
    const immediateCount = plan.immediateSteps.filter(
      (s) => s.taskTemplate
    ).length;
    const shortTermCount = plan.shortTermActions.filter(
      (s) => s.taskTemplate
    ).length;

    return immediateCount + shortTermCount;
  }
}

/**
 * Singleton instance for convenience
 */
export const taskIntegrationService = new TaskIntegrationService();

/**
 * Create tasks from action plan (convenience function)
 *
 * @param options - Task creation options
 * @returns Task creation result
 */
export function createTasksFromActionPlan(
  options: TaskCreationOptions
): TaskCreationResult {
  return taskIntegrationService.createTasksFromPlan(options);
}

/**
 * Count tasks that can be created from action plan (convenience function)
 *
 * @param plan - Action plan
 * @returns Number of tasks with templates
 */
export function countCreatableTasks(plan: AssessmentActionPlan): number {
  return taskIntegrationService.countCreatableTasks(plan);
}
