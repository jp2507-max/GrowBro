/**
 * Template Saver Service
 *
 * Handles saving customized playbooks as templates:
 * - Analyzes customization percentage
 * - Validates template structure
 * - Creates new playbook from customized tasks
 * - Strips PII and personal data
 * - Emits analytics events
 */

import { type Database, Q, type RawRecord } from '@nozbe/watermelondb';
import { randomUUID } from 'expo-crypto';

import type {
  Playbook,
  PlaybookMetadata,
  PlaybookStep,
  PlaybookTaskMetadata,
} from '@/types/playbook';

import type { AnalyticsClient } from '../analytics';
import type { PlaybookModel } from '../watermelon-models/playbook';
import type { TaskModel } from '../watermelon-models/task';

/**
 * Extended RawRecord type for playbook template fields
 * These fields are set directly on _raw for template metadata
 */
type PlaybookRawRecord = RawRecord & {
  is_template?: boolean;
  is_community?: boolean;
  author_handle?: string | null;
  license?: string | null;
};

export interface TemplateSaverOptions {
  database: Database;
  analytics: AnalyticsClient;
}

export interface TemplateValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface SaveTemplateOptions {
  name: string;
  description?: string;
  tags?: string[];
  license?: string;
  authorHandle?: string;
  isCommunity?: boolean;
}

export class TemplateSaverService {
  private database: Database;
  private analytics: AnalyticsClient;

  constructor(options: TemplateSaverOptions) {
    this.database = options.database;
    this.analytics = options.analytics;
  }

  /**
   * Analyze customizations for a plant's playbook tasks
   */
  async analyzeCustomizations(plantId: string): Promise<{
    totalTasks: number;
    customizedTasks: number;
    customizationPercentage: number;
    shouldPromptSave: boolean;
    customizedTaskIds: string[];
  }> {
    const allTasks = await this.database
      .get<TaskModel>('tasks')
      .query(Q.where('plant_id', plantId), Q.where('deleted_at', null))
      .fetch();

    // Filter tasks that have a playbook_id
    const tasks = allTasks.filter((task) => task.playbookId != null);

    const customizedTasks = tasks.filter((task) => {
      const metadata = task.metadata as PlaybookTaskMetadata | undefined;
      return metadata?.flags?.manualEdited === true;
    });

    const customizationPercentage =
      tasks.length > 0 ? (customizedTasks.length / tasks.length) * 100 : 0;

    return {
      totalTasks: tasks.length,
      customizedTasks: customizedTasks.length,
      customizationPercentage,
      shouldPromptSave: customizationPercentage >= 20,
      customizedTaskIds: customizedTasks.map((t) => t.id),
    };
  }

  /**
   * Save customized tasks as a new playbook template
   */
  async saveAsTemplate(
    plantId: string,
    options: SaveTemplateOptions
  ): Promise<Playbook> {
    const tasks = await this.getPlaybookTasks(plantId);

    // Guard: ensure at least one task has a valid playbookId
    const playbookId =
      tasks?.[0]?.playbookId || tasks.find((t) => t.playbookId)?.playbookId;
    if (!playbookId) {
      throw new Error(
        'Cannot save as template: missing playbookId on tasks — ensure tasks belong to a playbook or re-run with valid tasks'
      );
    }

    const originalPlaybook = await this.getOriginalPlaybook(tasks);
    const steps = this.convertTasksToSteps(tasks, originalPlaybook);
    const newPlaybook = this.createPlaybookFromTasks({
      tasks,
      originalPlaybook,
      steps,
      options,
    });

    this.validateTemplateOrThrow(newPlaybook);
    await this.savePlaybookToDatabase(newPlaybook);
    this.trackTemplateSaved(newPlaybook, options);

    return newPlaybook;
  }

  /**
   * Get playbook tasks for a plant
   */
  private async getPlaybookTasks(plantId: string): Promise<TaskModel[]> {
    const allTasks = await this.database
      .get<TaskModel>('tasks')
      .query(
        Q.where('plant_id', plantId),
        Q.where('deleted_at', null),
        Q.sortBy('due_at_utc', Q.asc)
      )
      .fetch();

    const tasks = allTasks.filter((task) => task.playbookId != null);

    if (tasks.length === 0) {
      throw new Error('No tasks found for plant');
    }

    return tasks;
  }

  /**
   * Get original playbook from tasks
   */
  private async getOriginalPlaybook(
    tasks: TaskModel[]
  ): Promise<PlaybookModel> {
    const originalPlaybookId = tasks[0].playbookId;
    if (!originalPlaybookId) {
      throw new Error('Tasks are not associated with a playbook');
    }

    return this.database
      .get<PlaybookModel>('playbooks')
      .find(originalPlaybookId);
  }

  /**
   * Create playbook object from tasks
   */
  private createPlaybookFromTasks(params: {
    tasks: TaskModel[];
    originalPlaybook: PlaybookModel;
    steps: PlaybookStep[];
    options: SaveTemplateOptions;
  }): Playbook {
    const { tasks, originalPlaybook, steps, options } = params;
    const newPlaybookId = randomUUID();
    const now = new Date().toISOString();

    const metadata: PlaybookMetadata = {
      author: options.authorHandle,
      tags: options.tags || [],
      difficulty: originalPlaybook.metadata?.difficulty,
      estimatedDuration: Math.max(
        1,
        Math.ceil(
          (new Date(tasks[tasks.length - 1].dueAtUtc).getTime() -
            new Date(tasks[0].dueAtUtc).getTime()) /
            (1000 * 60 * 60 * 24 * 7)
        )
      ),
      strainTypes: originalPlaybook.metadata?.strainTypes,
    };

    return {
      id: newPlaybookId,
      name: options.name,
      setup: originalPlaybook.setup,
      locale: originalPlaybook.locale,
      phaseOrder: originalPlaybook.phaseOrder || [],
      steps,
      metadata,
      isTemplate: true,
      isCommunity: options.isCommunity || false,
      authorHandle: options.authorHandle,
      license: options.license || 'CC-BY-SA',
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Validate template or throw error
   */
  private validateTemplateOrThrow(playbook: Playbook): void {
    const validation = this.validateTemplate(playbook);
    if (!validation.valid) {
      throw new Error(
        `Template validation failed: ${validation.errors.join(', ')}`
      );
    }
  }

  /**
   * Save playbook to database
   */
  private async savePlaybookToDatabase(playbook: Playbook): Promise<void> {
    await this.database.write(async () => {
      const createdRecord = await this.database
        .get<PlaybookModel>('playbooks')
        .create((record) => {
          record.name = playbook.name;
          record.setup = playbook.setup;
          record.locale = playbook.locale;
          record.phaseOrder = playbook.phaseOrder;
          record.steps = playbook.steps;
          record.metadata = playbook.metadata;
          record.isTemplate = playbook.isTemplate;
          record.isCommunity = playbook.isCommunity;
          record.authorHandle = playbook.authorHandle;
          record.license = playbook.license;
        });

      // Update the playbook object to match the database record
      playbook.id = createdRecord.id;
      playbook.createdAt = createdRecord.createdAt.toISOString();
      playbook.updatedAt = createdRecord.updatedAt.toISOString();

      // Ensure template-related raw fields are properly set
      const raw = createdRecord._raw as PlaybookRawRecord;
      raw.is_template = playbook.isTemplate;
      raw.is_community = playbook.isCommunity;
      raw.author_handle = playbook.authorHandle;
      raw.license = playbook.license;
    });
  }

  /**
   * Track template saved event
   */
  private trackTemplateSaved(
    playbook: Playbook,
    options: SaveTemplateOptions
  ): void {
    this.analytics.track('playbook_saved_as_template', {
      playbookId: playbook.id,
      templateName: options.name,
      isPublic: options.isCommunity || false,
    });
  }

  /**
   * Validate template structure and content
   */
  validateTemplate(playbook: Playbook): TemplateValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!playbook.name || playbook.name.trim().length === 0) {
      errors.push('Template name is required');
    }

    if (!playbook.setup) {
      errors.push('Setup type is required');
    }

    if (!playbook.locale) {
      errors.push('Locale is required');
    }

    if (!playbook.phaseOrder || playbook.phaseOrder.length === 0) {
      errors.push('Phase order is required');
    }

    if (!playbook.steps || playbook.steps.length === 0) {
      errors.push('At least one step is required');
    }

    // Validate steps
    if (playbook.steps) {
      playbook.steps.forEach((step, index) => {
        if (!step.id) {
          errors.push(`Step ${index + 1} is missing an ID`);
        }
        if (!step.title || step.title.trim().length === 0) {
          errors.push(`Step ${index + 1} is missing a title`);
        }
        if (!step.phase) {
          errors.push(`Step ${index + 1} is missing a phase`);
        }
        if (step.relativeDay === undefined || step.relativeDay < 0) {
          errors.push(`Step ${index + 1} has invalid relativeDay`);
        }
        if (!step.taskType) {
          errors.push(`Step ${index + 1} is missing taskType`);
        }
      });
    }

    // Check for PII (warnings)
    if (playbook.name.match(/\b\d{3}-\d{3}-\d{4}\b/)) {
      warnings.push('Template name may contain phone number');
    }
    if (playbook.name.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)) {
      warnings.push('Template name may contain email address');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Convert tasks to playbook steps
   * Strips personal data and normalizes structure
   */
  private convertTasksToSteps(
    tasks: TaskModel[],
    originalPlaybook: PlaybookModel
  ): PlaybookStep[] {
    const steps: PlaybookStep[] = [];
    const firstTaskDate = new Date(tasks[0].dueAtUtc);

    // Create a map of original steps by ID for quick lookup
    const originalStepsMap = new Map(
      originalPlaybook.steps.map((step) => [step.id, step])
    );

    tasks.forEach((task) => {
      const metadata = task.metadata as PlaybookTaskMetadata | undefined;
      const taskDate = new Date(task.dueAtUtc);
      const relativeDay = Math.floor(
        (taskDate.getTime() - firstTaskDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Find the original step to preserve its data
      const originalStep = task.originStepId
        ? originalStepsMap.get(task.originStepId)
        : undefined;

      // Extract reminder time in HH:mm format - prefer original step's value
      let defaultReminderLocal = originalStep?.defaultReminderLocal || '09:00';
      if (!originalStep && task.reminderAtLocal) {
        // Fallback to deriving from task reminder if no original step
        const reminderDate = new Date(task.reminderAtLocal);
        defaultReminderLocal = `${String(reminderDate.getHours()).padStart(2, '0')}:${String(reminderDate.getMinutes()).padStart(2, '0')}`;
      }

      const step: PlaybookStep = {
        id: task.originStepId || randomUUID(),
        phase:
          originalStep?.phase ||
          (metadata?.phaseIndex !== undefined
            ? this.inferPhaseFromIndex(metadata.phaseIndex)
            : 'veg'),
        title: task.title,
        descriptionIcu: task.description || '',
        relativeDay: originalStep?.relativeDay ?? relativeDay,
        defaultReminderLocal,
        taskType: this.inferTaskType(task.title),
        dependencies: originalStep?.dependencies || [],
        rrule: originalStep?.rrule,
        durationDays: originalStep?.durationDays,
      };

      steps.push(step);
    });

    return steps;
  }

  /**
   * Infer phase from phase index
   */
  private inferPhaseFromIndex(
    phaseIndex?: number
  ): 'seedling' | 'veg' | 'flower' | 'harvest' {
    switch (phaseIndex) {
      case 0:
        return 'seedling';
      case 1:
        return 'veg';
      case 2:
        return 'flower';
      case 3:
        return 'harvest';
      default:
        return 'veg';
    }
  }

  /**
   * Infer task type from title
   */
  private inferTaskType(title: string): PlaybookStep['taskType'] {
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes('water')) return 'water';
    if (lowerTitle.includes('feed') || lowerTitle.includes('nutrient'))
      return 'feed';
    if (lowerTitle.includes('prune') || lowerTitle.includes('trim'))
      return 'prune';
    if (lowerTitle.includes('train') || lowerTitle.includes('lst'))
      return 'train';
    if (lowerTitle.includes('monitor') || lowerTitle.includes('check'))
      return 'monitor';
    if (lowerTitle.includes('note')) return 'note';
    return 'custom';
  }
}
