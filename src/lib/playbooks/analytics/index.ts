/* eslint-disable max-params */
/**
 * Analytics and observability system for playbook operations
 *
 * This module provides comprehensive tracking for:
 * - Playbook operations (apply, shift, customize)
 * - Notification delivery metrics
 * - Sync performance monitoring
 * - Conflict resolution tracking
 * - AI suggestion outcomes
 * - Trichome helper usage
 *
 * Usage:
 * ```ts
 * import { analytics } from '@/lib/playbooks/analytics';
 *
 * // Track playbook apply
 * analytics.trackPlaybookApply(playbookId, plantId, taskCount, durationMs, jobId);
 *
 * // Track notification delivery
 * analytics.trackNotificationDelivered(notificationId, actualTime);
 *
 * // Get health status
 * const health = analytics.getHealthStatus();
 * ```
 */

import { metricsAggregator } from './metrics-aggregator';
import { notificationMetrics } from './notification-metrics';
import { analyticsService } from './service';
import { syncMetrics } from './sync-metrics';
import type {
  AISuggestionEvent,
  ConflictSeenEvent,
  NotificationMissedEvent,
  PlaybookApplyEvent,
  PlaybookSavedAsTemplateEvent,
  PlaybookShiftApplyEvent,
  PlaybookShiftPreviewEvent,
  PlaybookShiftUndoEvent,
  PlaybookTaskCustomizedEvent,
  TrichomeHelperLoggedEvent,
  TrichomeHelperOpenEvent,
} from './types';

/**
 * Main analytics API
 */
export const analytics = {
  // Playbook operations
  trackPlaybookApply(
    playbookId: string,
    plantId: string,
    appliedTaskCount: number,
    durationMs: number,
    jobId: string
  ): void {
    analyticsService.track<PlaybookApplyEvent>('playbook_apply', {
      playbookId,
      plantId,
      appliedTaskCount,
      durationMs,
      jobId,
    });
  },

  trackPlaybookShiftPreview(
    plantId: string,
    daysDelta: number,
    affectedTaskCount: number,
    includeCompleted: boolean = false,
    includeManuallyEdited: boolean = false
  ): void {
    analyticsService.track<PlaybookShiftPreviewEvent>(
      'playbook_shift_preview',
      {
        plantId,
        daysDelta,
        affectedTaskCount,
        includeCompleted,
        includeManuallyEdited,
      }
    );
  },

  trackPlaybookShiftApply(
    plantId: string,
    shiftId: string,
    daysDelta: number,
    affectedTaskCount: number,
    durationMs: number
  ): void {
    analyticsService.track<PlaybookShiftApplyEvent>('playbook_shift_apply', {
      plantId,
      shiftId,
      daysDelta,
      affectedTaskCount,
      durationMs,
    });
  },

  trackPlaybookShiftUndo(
    plantId: string,
    shiftId: string,
    restoredTaskCount: number,
    durationMs: number
  ): void {
    analyticsService.track<PlaybookShiftUndoEvent>('playbook_shift_undo', {
      plantId,
      shiftId,
      restoredTaskCount,
      durationMs,
    });
  },

  trackPlaybookTaskCustomized(
    taskId: string,
    plantId: string,
    playbookId: string,
    changedFields: string[],
    breaksInheritance: boolean
  ): void {
    analyticsService.track<PlaybookTaskCustomizedEvent>(
      'playbook_task_customized',
      {
        taskId,
        plantId,
        playbookId,
        changedFields,
        breaksInheritance,
      }
    );
  },

  trackPlaybookSavedAsTemplate(
    playbookId: string,
    plantId: string,
    customizationCount: number,
    templateName: string
  ): void {
    analyticsService.track<PlaybookSavedAsTemplateEvent>(
      'playbook_saved_as_template',
      {
        playbookId,
        plantId,
        customizationCount,
        templateName,
      }
    );
  },

  // Notification tracking
  trackNotificationScheduled(
    notificationId: string,
    taskId: string,
    scheduledTime: number,
    isExactAlarm: boolean = false
  ): void {
    notificationMetrics.trackScheduled(
      notificationId,
      taskId,
      scheduledTime,
      isExactAlarm
    );
  },

  trackNotificationDelivered(
    notificationId: string,
    actualDeliveryTime: number
  ): void {
    notificationMetrics.trackDelivered(notificationId, actualDeliveryTime);
  },

  trackNotificationMissed(
    notificationId: string,
    reason: NotificationMissedEvent['reason']
  ): void {
    notificationMetrics.trackMissed(notificationId, reason);
  },

  // Sync tracking
  trackSyncStart(syncId: string, operation: 'pull' | 'push' | 'full'): void {
    syncMetrics.trackSyncStart(syncId, operation);
  },

  trackSyncComplete(syncId: string, recordsSynced: number): void {
    syncMetrics.trackSyncComplete(syncId, recordsSynced);
  },

  trackSyncFail(syncId: string, errorCode: string, retryable: boolean): void {
    syncMetrics.trackSyncFail(syncId, errorCode, retryable);
  },

  // Conflict tracking
  trackConflictSeen(
    table: string,
    recordId: string,
    conflictType: ConflictSeenEvent['conflictType'],
    resolution: ConflictSeenEvent['resolution']
  ): void {
    syncMetrics.trackConflictSeen(table, recordId, conflictType, resolution);
  },

  trackConflictRestored(
    table: string,
    recordId: string,
    conflictType: ConflictSeenEvent['conflictType']
  ): void {
    syncMetrics.trackConflictRestored(table, recordId, conflictType);
  },

  // AI suggestion tracking
  trackAISuggested(
    plantId: string,
    suggestionId: string,
    rootCause: string,
    confidence: number,
    affectedTaskCount: number,
    reasoning: string
  ): void {
    analyticsService.track<AISuggestionEvent>('ai_suggested', {
      plantId,
      suggestionId,
      rootCause,
      confidence,
      affectedTaskCount,
      reasoning,
    });
  },

  trackAIApplied(
    plantId: string,
    suggestionId: string,
    rootCause: string,
    confidence: number,
    affectedTaskCount: number,
    helpfulVote?: boolean
  ): void {
    analyticsService.track<AISuggestionEvent>('ai_applied', {
      plantId,
      suggestionId,
      rootCause,
      confidence,
      affectedTaskCount,
      helpfulVote,
    });
  },

  trackAIDeclined(
    plantId: string,
    suggestionId: string,
    rootCause: string,
    confidence: number,
    affectedTaskCount: number,
    helpfulVote?: boolean
  ): void {
    analyticsService.track<AISuggestionEvent>('ai_declined', {
      plantId,
      suggestionId,
      rootCause,
      confidence,
      affectedTaskCount,
      helpfulVote,
    });
  },

  // Trichome helper tracking
  trackTrichomeHelperOpen(plantId: string, phase: string): void {
    analyticsService.track<TrichomeHelperOpenEvent>('trichome_helper_open', {
      plantId,
      phase,
    });
  },

  trackTrichomeHelperLogged(
    plantId: string,
    assessment: TrichomeHelperLoggedEvent['assessment'],
    hasPhoto: boolean,
    photoCount: number,
    harvestWindowAdjustment?: number
  ): void {
    analyticsService.track<TrichomeHelperLoggedEvent>(
      'trichome_helper_logged',
      {
        plantId,
        assessment,
        hasPhoto,
        photoCount,
        harvestWindowAdjustment,
      }
    );
  },

  // Metrics and health
  getNotificationMetrics: () => notificationMetrics.getMetrics(),
  getSyncMetrics: () => syncMetrics.getSyncMetrics(),
  getConflictMetrics: () => syncMetrics.getConflictMetrics(),
  getAggregatedMetrics: () => metricsAggregator.getAggregatedMetrics(),
  getHealthStatus: () => metricsAggregator.getHealthStatus(),
  getMetricsReport: () => metricsAggregator.getMetricsReport(),

  // Maintenance
  emitSummary: () => metricsAggregator.emitSummary(),
  resetMetrics: () => metricsAggregator.resetAllMetrics(),
  cleanupOldNotifications: (maxAgeMs?: number) =>
    notificationMetrics.cleanupOldScheduled(maxAgeMs),

  // Service control
  configure: analyticsService.configure.bind(analyticsService),
  flush: () => analyticsService.flush(),
  shutdown: () => analyticsService.shutdown(),
  resetSession: () => analyticsService.resetSession(),
  getSessionId: () => analyticsService.getSessionId(),
};

// Re-export types
export type {
  AnalyticsEvent,
  ConflictMetrics,
  NotificationMetrics,
  SyncMetrics,
} from './types';
