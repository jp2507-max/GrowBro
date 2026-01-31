/**
 * AI-driven schedule adjustment service
 * Handles suggestion generation, gating, cooldowns, and outcome tracking
 */

import { type Database, Q } from '@nozbe/watermelondb';

import { type AdjustmentCooldownModel } from '@/lib/watermelon-models/adjustment-cooldown';
import { type AdjustmentSuggestionModel } from '@/lib/watermelon-models/adjustment-suggestion';
import { type PlantAdjustmentPreferenceModel } from '@/lib/watermelon-models/plant-adjustment-preference';
import type { TaskModel } from '@/lib/watermelon-models/task';
import type {
  AdjustmentContext,
  AdjustmentRootCause,
  AdjustmentSuggestion,
  AdjustmentThresholds,
  HelpfulnessVote,
  TaskAdjustment,
} from '@/types/ai-adjustments';

import { getFeatureFlags } from '../feature-flags';

const COOLDOWN_DAYS = 7;
const SUGGESTION_EXPIRY_DAYS = 3;

export class AIAdjustmentService {
  constructor(private database: Database) {}

  /**
   * Check if AI adjustments are enabled and thresholds are met
   */
  async shouldSuggestAdjustments(
    context: AdjustmentContext
  ): Promise<{ shouldSuggest: boolean; reason?: string }> {
    const flags = getFeatureFlags();

    // Check feature flag
    if (!flags.aiAdjustmentsEnabled) {
      return { shouldSuggest: false, reason: 'feature_disabled' };
    }

    // Check if plant has "never suggest" preference
    const preference = await this.getPlantPreference(context.plantId);
    if (preference?.neverSuggest) {
      return { shouldSuggest: false, reason: 'user_disabled' };
    }

    // Check thresholds
    const thresholds: AdjustmentThresholds = {
      minSkippedTasks: flags.aiAdjustmentsMinSkippedTasks,
      minConfidence: flags.aiAdjustmentsMinConfidence,
      cooldownDays: COOLDOWN_DAYS,
    };

    const meetsSkippedThreshold =
      (context.skippedTaskCount ?? 0) >= thresholds.minSkippedTasks;
    const meetsConfidenceThreshold =
      context.assessmentConfidence !== undefined &&
      context.assessmentConfidence < thresholds.minConfidence;

    if (!meetsSkippedThreshold && !meetsConfidenceThreshold) {
      return { shouldSuggest: false, reason: 'thresholds_not_met' };
    }

    // Determine root cause
    const rootCause: AdjustmentRootCause = meetsSkippedThreshold
      ? 'skipped_tasks'
      : 'low_confidence_assessment';

    // Check cooldown
    const isInCooldown = await this.isInCooldown(context.plantId, rootCause);
    if (isInCooldown) {
      return { shouldSuggest: false, reason: 'cooldown_active' };
    }

    return { shouldSuggest: true };
  }

  /**
   * Generate adjustment suggestions based on context
   */
  async generateSuggestions(
    context: AdjustmentContext
  ): Promise<AdjustmentSuggestion | null> {
    const { shouldSuggest, reason } =
      await this.shouldSuggestAdjustments(context);

    if (!shouldSuggest) {
      console.log(`[AIAdjustmentService] Not suggesting: ${reason}`);
      return null;
    }

    // Determine root cause and generate appropriate suggestions
    const rootCause: AdjustmentRootCause =
      (context.skippedTaskCount ?? 0) >= 2
        ? 'skipped_tasks'
        : 'low_confidence_assessment';

    const affectedTasks = await this.generateTaskAdjustments(
      context.plantId,
      rootCause
    );

    if (affectedTasks.length === 0) {
      return null;
    }

    const reasoning = this.generateReasoning(rootCause, context);
    const confidence = this.calculateConfidence(context, affectedTasks);

    const expiresAt = Date.now() + SUGGESTION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

    const suggestion: AdjustmentSuggestion = {
      id: this.generateId(),
      plantId: context.plantId,
      playbookId: context.playbookId,
      suggestionType: this.mapRootCauseToType(rootCause),
      rootCause,
      reasoning,
      affectedTasks,
      confidence,
      status: 'pending',
      expiresAt,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Store suggestion in database
    await this.storeSuggestion(suggestion);

    return suggestion;
  }

  /**
   * Apply accepted suggestions (full or partial)
   */
  async applySuggestion(
    suggestionId: string,
    acceptedTaskIds?: string[]
  ): Promise<void> {
    const suggestion = await this.getSuggestion(suggestionId);
    if (!suggestion) {
      throw new Error('Suggestion not found');
    }

    if (suggestion.status !== 'pending') {
      throw new Error('Suggestion already processed');
    }

    // Update tasks based on accepted suggestions
    const tasksToUpdate = acceptedTaskIds
      ? suggestion.affectedTasks.filter((t) =>
          acceptedTaskIds.includes(t.taskId)
        )
      : suggestion.affectedTasks;

    await this.database.write(async () => {
      const tasksCollection = this.database.get<TaskModel>('tasks');

      for (const taskAdjustment of tasksToUpdate) {
        const task = await tasksCollection.find(taskAdjustment.taskId);
        await task.update((t) => {
          t.dueAtLocal = taskAdjustment.proposedDueDate;
          // Note: In production, also update dueAtUtc, timezone, and notifications
        });
      }

      // Update suggestion status
      const suggestionsCollection =
        this.database.get<AdjustmentSuggestionModel>('adjustment_suggestions');
      const suggestionRecord = await suggestionsCollection.find(suggestionId);
      await suggestionRecord.update((s) => {
        s.status = 'accepted';
        s.acceptedTasks = acceptedTaskIds || [];
        s.updatedAt = Date.now();
      });
    });

    // Set cooldown
    await this.setCooldown(suggestion.plantId, suggestion.rootCause);
  }

  /**
   * Decline a suggestion
   */
  async declineSuggestion(suggestionId: string): Promise<void> {
    const suggestion = await this.getSuggestion(suggestionId);
    if (!suggestion) {
      throw new Error('Suggestion not found');
    }

    await this.database.write(async () => {
      const suggestionsCollection =
        this.database.get<AdjustmentSuggestionModel>('adjustment_suggestions');
      const suggestionRecord = await suggestionsCollection.find(suggestionId);
      await suggestionRecord.update((s) => {
        s.status = 'declined';
        s.updatedAt = Date.now();
      });
    });

    // Set cooldown
    await this.setCooldown(suggestion.plantId, suggestion.rootCause);
  }

  /**
   * Record helpfulness vote
   */
  async voteHelpfulness(
    suggestionId: string,
    vote: HelpfulnessVote
  ): Promise<void> {
    await this.database.write(async () => {
      const suggestionsCollection =
        this.database.get<AdjustmentSuggestionModel>('adjustment_suggestions');
      const suggestionRecord = await suggestionsCollection.find(suggestionId);
      await suggestionRecord.update((s) => {
        s.helpfulnessVote = vote;
        s.updatedAt = Date.now();
      });
    });
  }

  /**
   * Set "never suggest" preference for a plant
   */
  async setNeverSuggest(plantId: string, neverSuggest: boolean): Promise<void> {
    await this.database.write(async () => {
      const preferencesCollection =
        this.database.get<PlantAdjustmentPreferenceModel>(
          'plant_adjustment_preferences'
        );
      const existing = await preferencesCollection
        .query(Q.where('plant_id', plantId))
        .fetch();

      if (existing.length > 0) {
        await existing[0].update((p) => {
          p.neverSuggest = neverSuggest;
          p.updatedAt = Date.now();
        });
      } else {
        await preferencesCollection.create((p) => {
          p.plantId = plantId;
          p.neverSuggest = neverSuggest;
          p.createdAt = Date.now();
          p.updatedAt = Date.now();
        });
      }
    });
  }

  /**
   * Get pending suggestions for a plant
   */
  async getPendingSuggestions(
    plantId: string
  ): Promise<AdjustmentSuggestion[]> {
    const suggestionsCollection = this.database.get<AdjustmentSuggestionModel>(
      'adjustment_suggestions'
    );
    const records = await suggestionsCollection
      .query(Q.where('plant_id', plantId), Q.where('status', 'pending'))
      .fetch();

    return records.map((r) => r.toAdjustmentSuggestion());
  }

  /**
   * Get accepted suggestions for a plant
   */
  async getAcceptedSuggestions(
    plantId: string
  ): Promise<AdjustmentSuggestion[]> {
    const suggestionsCollection = this.database.get<AdjustmentSuggestionModel>(
      'adjustment_suggestions'
    );
    const records = await suggestionsCollection
      .query(Q.where('plant_id', plantId), Q.where('status', 'accepted'))
      .fetch();

    return records.map((r) => r.toAdjustmentSuggestion());
  }

  // Private helper methods

  private async getPlantPreference(
    plantId: string
  ): Promise<{ neverSuggest: boolean } | null> {
    const preferencesCollection =
      this.database.get<PlantAdjustmentPreferenceModel>(
        'plant_adjustment_preferences'
      );
    const records = await preferencesCollection
      .query(Q.where('plant_id', plantId))
      .fetch();

    if (records.length === 0) return null;

    return {
      neverSuggest: records[0].neverSuggest,
    };
  }

  private async isInCooldown(
    plantId: string,
    rootCause: AdjustmentRootCause
  ): Promise<boolean> {
    const cooldownsCollection = this.database.get<AdjustmentCooldownModel>(
      'adjustment_cooldowns'
    );
    const records = await cooldownsCollection
      .query(Q.where('plant_id', plantId), Q.where('root_cause', rootCause))
      .fetch();

    if (records.length === 0) return false;

    return records.some((record) => record.isActive());
  }

  private async setCooldown(
    plantId: string,
    rootCause: AdjustmentRootCause
  ): Promise<void> {
    const cooldownUntil = Date.now() + COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

    await this.database.write(async () => {
      const cooldownsCollection = this.database.get<AdjustmentCooldownModel>(
        'adjustment_cooldowns'
      );
      const existing = await cooldownsCollection
        .query(Q.where('plant_id', plantId), Q.where('root_cause', rootCause))
        .fetch();

      if (existing.length > 0) {
        // Update existing record
        await existing[0].update((c) => {
          c.cooldownUntil = cooldownUntil;
          c.createdAt = Date.now();
        });
      } else {
        // Create new record
        await cooldownsCollection.create((c) => {
          c.plantId = plantId;
          c.rootCause = rootCause;
          c.cooldownUntil = cooldownUntil;
          c.createdAt = Date.now();
        });
      }
    });
  }

  private async generateTaskAdjustments(
    plantId: string,
    rootCause: AdjustmentRootCause
  ): Promise<TaskAdjustment[]> {
    // Simplified implementation - in production, this would use AI/ML
    const tasksCollection = this.database.get('tasks');
    const tasks = await tasksCollection
      .query(Q.where('plant_id', plantId), Q.where('status', 'pending'))
      .fetch();

    const adjustments: TaskAdjustment[] = [];

    for (const task of tasks.slice(0, 5)) {
      // Limit to 5 tasks
      const taskModel = task as TaskModel;
      const currentDueDate = taskModel.dueAtLocal;
      const proposedDueDate = this.calculateProposedDate(
        currentDueDate,
        rootCause
      );

      adjustments.push({
        taskId: task.id,
        currentDueDate,
        proposedDueDate,
        reason: this.getAdjustmentReason(rootCause),
        phase: taskModel.phaseIndex?.toString(),
      });
    }

    return adjustments;
  }

  private calculateProposedDate(
    currentDate: string,
    rootCause: AdjustmentRootCause
  ): string {
    // Simplified - in production, use proper date manipulation
    const date = new Date(currentDate);
    const daysToAdd = rootCause === 'skipped_tasks' ? 2 : 1;
    date.setDate(date.getDate() + daysToAdd);
    return date.toISOString().split('T')[0];
  }

  private getAdjustmentReason(rootCause: AdjustmentRootCause): string {
    const reasons: Record<AdjustmentRootCause, string> = {
      skipped_tasks: 'Adjusting schedule based on recent skipped tasks',
      low_confidence_assessment: 'Adjusting based on plant health assessment',
      environmental_stress: 'Adjusting for environmental conditions',
      nutrient_deficiency: 'Adjusting feeding schedule',
      overwatering: 'Reducing watering frequency',
      underwatering: 'Increasing watering frequency',
    };
    return reasons[rootCause];
  }

  private generateReasoning(
    rootCause: AdjustmentRootCause,
    context: AdjustmentContext
  ): string {
    if (rootCause === 'skipped_tasks') {
      return `You've skipped ${context.skippedTaskCount} tasks in the past 7 days. This suggests your current schedule may be too aggressive. We recommend adjusting upcoming tasks to better fit your availability.`;
    }

    if (rootCause === 'low_confidence_assessment') {
      return `Recent plant health assessments show ${Math.round((1 - (context.assessmentConfidence ?? 0)) * 100)}% uncertainty. Adjusting the schedule may help address potential issues before they become serious.`;
    }

    return 'Based on your grow patterns, we recommend adjusting your schedule.';
  }

  private calculateConfidence(
    context: AdjustmentContext,
    adjustments: TaskAdjustment[]
  ): number {
    // Simplified confidence calculation
    let confidence = 0.5;

    if (context.skippedTaskCount && context.skippedTaskCount >= 3) {
      confidence += 0.2;
    }

    if (
      context.assessmentConfidence !== undefined &&
      context.assessmentConfidence < 0.6
    ) {
      confidence += 0.2;
    }

    if (adjustments.length > 0) {
      confidence += 0.1;
    }

    return Math.min(confidence, 0.95);
  }

  private mapRootCauseToType(
    rootCause: AdjustmentRootCause
  ): AdjustmentSuggestion['suggestionType'] {
    const mapping: Record<
      AdjustmentRootCause,
      AdjustmentSuggestion['suggestionType']
    > = {
      skipped_tasks: 'schedule_shift',
      low_confidence_assessment: 'environment',
      environmental_stress: 'environment',
      nutrient_deficiency: 'feeding',
      overwatering: 'watering',
      underwatering: 'watering',
    };
    return mapping[rootCause];
  }

  private async storeSuggestion(
    suggestion: AdjustmentSuggestion
  ): Promise<void> {
    await this.database.write(async () => {
      const suggestionsCollection =
        this.database.get<AdjustmentSuggestionModel>('adjustment_suggestions');
      await suggestionsCollection.create((s) => {
        s._raw.id = suggestion.id;
        s.plantId = suggestion.plantId;
        s.playbookId = suggestion.playbookId;
        s.suggestionType = suggestion.suggestionType;
        s.rootCause = suggestion.rootCause;
        s.reasoning = suggestion.reasoning;
        s.affectedTasks = suggestion.affectedTasks;
        s.confidence = suggestion.confidence;
        s.status = suggestion.status;
        s.expiresAt = suggestion.expiresAt;
        s.createdAt = suggestion.createdAt;
        s.updatedAt = suggestion.updatedAt;
      });
    });
  }

  private async getSuggestion(
    suggestionId: string
  ): Promise<AdjustmentSuggestion | null> {
    try {
      const suggestionsCollection =
        this.database.get<AdjustmentSuggestionModel>('adjustment_suggestions');
      const record = await suggestionsCollection.find(suggestionId);
      return record.toAdjustmentSuggestion();
    } catch {
      return null;
    }
  }

  private generateId(): string {
    return `adj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
