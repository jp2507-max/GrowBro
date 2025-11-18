/**
 * Task Customization Service
 *
 * Handles task editing with inheritance tracking:
 * - Preserves origin linkage (playbook_id, origin_step_id)
 * - Sets flags.manualEdited=true on first edit
 * - Determines which field changes break inheritance
 * - Manages custom notes and reminder overrides
 * - Emits analytics events for customization tracking
 */

import { type Database, Q } from '@nozbe/watermelondb';

import type { PlaybookTaskMetadata } from '@/types/playbook';

import type { AnalyticsClient } from '../analytics';
import type { TaskModel } from '../watermelon-models/task';

export interface TaskCustomizationOptions {
  database: Database;
  analytics: AnalyticsClient;
}

export interface TaskUpdateFields {
  title?: string;
  description?: string;
  dueAtLocal?: string;
  dueAtUtc?: string;
  reminderAtLocal?: string;
  reminderAtUtc?: string;
  customNotes?: string;
}

/**
 * Fields that break inheritance when modified
 * These changes will exclude the task from future bulk operations
 */
const INHERITANCE_BREAKING_FIELDS = [
  'title',
  'description',
  'dueAtLocal',
  'dueAtUtc',
  'reminderAtLocal',
  'reminderAtUtc',
] as const;

export class TaskCustomizationService {
  private database: Database;
  private analytics: AnalyticsClient;

  constructor(options: TaskCustomizationOptions) {
    this.database = options.database;
    this.analytics = options.analytics;
  }

  /**
   * Update task with inheritance tracking
   * Sets manualEdited flag on first edit and tracks field changes
   */
  async updateTask(
    taskId: string,
    updates: TaskUpdateFields
  ): Promise<{ task: TaskModel; fieldsChanged: string[] }> {
    const task = await this.database.get<TaskModel>('tasks').find(taskId);

    const fieldsChanged = this.detectChangedFields(task, updates);
    const breaksInheritance = this.determineInheritanceBreak(fieldsChanged);

    let updatedTask: TaskModel;
    await this.database.write(async () => {
      updatedTask = await task.update((record) => {
        // Apply field updates
        if (updates.title !== undefined) record.title = updates.title;
        if (updates.description !== undefined)
          record.description = updates.description || undefined;
        if (updates.dueAtLocal !== undefined)
          record.dueAtLocal = updates.dueAtLocal;
        if (updates.dueAtUtc !== undefined) record.dueAtUtc = updates.dueAtUtc;
        if (updates.reminderAtLocal !== undefined)
          record.reminderAtLocal = updates.reminderAtLocal || undefined;
        if (updates.reminderAtUtc !== undefined)
          record.reminderAtUtc = updates.reminderAtUtc || undefined;

        // Update metadata with flags and custom notes
        const currentMetadata = (record.metadata || {}) as PlaybookTaskMetadata;
        const updatedMetadata: PlaybookTaskMetadata = {
          ...currentMetadata,
          flags: {
            manualEdited: true,
            excludeFromBulkShift:
              breaksInheritance ||
              currentMetadata.flags?.excludeFromBulkShift ||
              false,
          },
        };

        // Add custom notes if provided
        if (updates.customNotes !== undefined) {
          updatedMetadata.customNotes = updates.customNotes;
        }

        record.metadata = updatedMetadata;
      });
    });

    // Emit analytics event
    this.trackCustomization(task, fieldsChanged, breaksInheritance);

    return { task: updatedTask!, fieldsChanged };
  }

  /**
   * Add or update custom notes for a task
   */
  async addCustomNote(taskId: string, notes: string): Promise<TaskModel> {
    const task = await this.database.get<TaskModel>('tasks').find(taskId);

    let updatedTask: TaskModel;
    await this.database.write(async () => {
      updatedTask = await task.update((record) => {
        const currentMetadata = (record.metadata || {}) as PlaybookTaskMetadata;
        const updatedMetadata: PlaybookTaskMetadata = {
          ...currentMetadata,
          customNotes: notes,
          flags: {
            manualEdited: true,
            excludeFromBulkShift:
              currentMetadata.flags?.excludeFromBulkShift || false,
          },
        };
        record.metadata = updatedMetadata;
      });
    });

    this.analytics.track('playbook_task_customized', {
      taskId,
      playbookId: task.playbookId || '',
      customizationType: 'modify',
    });

    return updatedTask!;
  }

  /**
   * Update reminder time for a task
   */
  async updateReminder(
    taskId: string,
    reminderAtLocal: string | null,
    reminderAtUtc: string | null
  ): Promise<TaskModel> {
    const task = await this.database.get<TaskModel>('tasks').find(taskId);

    let updatedTask: TaskModel;
    await this.database.write(async () => {
      updatedTask = await task.update((record) => {
        record.reminderAtLocal = reminderAtLocal || undefined;
        record.reminderAtUtc = reminderAtUtc || undefined;

        const currentMetadata = (record.metadata || {}) as PlaybookTaskMetadata;
        const updatedMetadata: PlaybookTaskMetadata = {
          ...currentMetadata,
          flags: {
            manualEdited: true,
            excludeFromBulkShift: true, // Reminder changes break inheritance
          },
        };
        record.metadata = updatedMetadata;
      });
    });

    this.analytics.track('playbook_task_customized', {
      taskId,
      playbookId: task.playbookId || '',
      customizationType: 'time',
    });

    return updatedTask!;
  }

  /**
   * Get customization statistics for a plant's playbook tasks
   */
  async getCustomizationStats(plantId: string): Promise<{
    totalTasks: number;
    customizedTasks: number;
    customizationPercentage: number;
    excludedFromBulkShift: number;
  }> {
    const tasks = await this.database
      .get<TaskModel>('tasks')
      .query(Q.where('plant_id', plantId), Q.where('deleted_at', null))
      .fetch();

    const customizedTasks = tasks.filter((task) => {
      const metadata = task.metadata as PlaybookTaskMetadata | undefined;
      return metadata?.flags?.manualEdited === true;
    });

    const excludedTasks = tasks.filter((task) => {
      const metadata = task.metadata as PlaybookTaskMetadata | undefined;
      return metadata?.flags?.excludeFromBulkShift === true;
    });

    return {
      totalTasks: tasks.length,
      customizedTasks: customizedTasks.length,
      customizationPercentage:
        tasks.length > 0 ? (customizedTasks.length / tasks.length) * 100 : 0,
      excludedFromBulkShift: excludedTasks.length,
    };
  }

  /**
   * Check if customization threshold is met for template saving
   */
  async shouldPromptTemplateSave(
    plantId: string,
    threshold: number = 20
  ): Promise<boolean> {
    const stats = await this.getCustomizationStats(plantId);
    return stats.customizationPercentage >= threshold;
  }

  /**
   * Detect which fields changed in an update
   */
  private detectChangedFields(
    task: TaskModel,
    updates: TaskUpdateFields
  ): string[] {
    const changed: string[] = [];

    if (updates.title !== undefined && updates.title !== task.title) {
      changed.push('title');
    }
    if (
      updates.description !== undefined &&
      updates.description !== task.description
    ) {
      changed.push('description');
    }
    if (
      updates.dueAtLocal !== undefined &&
      updates.dueAtLocal !== task.dueAtLocal
    ) {
      changed.push('dueAtLocal');
    }
    if (updates.dueAtUtc !== undefined && updates.dueAtUtc !== task.dueAtUtc) {
      changed.push('dueAtUtc');
    }
    if (
      updates.reminderAtLocal !== undefined &&
      updates.reminderAtLocal !== task.reminderAtLocal
    ) {
      changed.push('reminderAtLocal');
    }
    if (
      updates.reminderAtUtc !== undefined &&
      updates.reminderAtUtc !== task.reminderAtUtc
    ) {
      changed.push('reminderAtUtc');
    }
    if (updates.customNotes !== undefined) {
      changed.push('customNotes');
    }

    return changed;
  }

  /**
   * Determine if field changes break inheritance
   */
  private determineInheritanceBreak(fieldsChanged: string[]): boolean {
    return fieldsChanged.some((field) =>
      INHERITANCE_BREAKING_FIELDS.includes(
        field as (typeof INHERITANCE_BREAKING_FIELDS)[number]
      )
    );
  }

  /**
   * Track customization in analytics
   */
  private trackCustomization(
    task: TaskModel,
    fieldsChanged: string[],
    breaksInheritance: boolean
  ): void {
    const customizationType = breaksInheritance ? 'modify' : 'modify';
    this.analytics.track('playbook_task_customized', {
      taskId: task.id,
      playbookId: task.playbookId || '',
      customizationType,
    });
  }
}
