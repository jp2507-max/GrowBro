/* eslint-disable max-params */
/**
 * Example usage of the analytics system
 *
 * This file demonstrates how to integrate analytics tracking
 * into various parts of the playbook system.
 */

import { analytics } from './index';

/**
 * Example: Tracking playbook application
 */
export async function applyPlaybookExample(
  playbookId: string,
  plantId: string
) {
  const startTime = Date.now();

  try {
    // Apply playbook logic here...
    const appliedTaskCount = 25;

    // Track successful application
    const durationMs = Date.now() - startTime;
    const jobId = `job-${Date.now()}`;

    analytics.trackPlaybookApply(
      playbookId,
      plantId,
      appliedTaskCount,
      durationMs,
      jobId
    );

    console.log('Playbook applied successfully');
  } catch (error) {
    console.error('Failed to apply playbook:', error);
  }
}

/**
 * Example: Tracking schedule shift with preview
 */
export async function shiftScheduleExample(plantId: string, daysDelta: number) {
  // Show preview
  const affectedTasks = 20; // Calculate from database
  analytics.trackPlaybookShiftPreview(plantId, daysDelta, affectedTasks);

  // User confirms shift
  const startTime = Date.now();
  const shiftId = `shift-${Date.now()}`;

  try {
    // Perform shift logic...

    const durationMs = Date.now() - startTime;
    analytics.trackPlaybookShiftApply(
      plantId,
      shiftId,
      daysDelta,
      affectedTasks,
      durationMs
    );

    // Provide undo option for 30 seconds
    setTimeout(() => {
      console.log('Undo window expired');
    }, 30000);
  } catch (error) {
    console.error('Failed to shift schedule:', error);
  }
}

/**
 * Example: Tracking notification lifecycle
 */
export async function scheduleNotificationExample(taskId: string) {
  const notificationId = `notif-${Date.now()}`;
  const scheduledTime = Date.now() + 3600000; // 1 hour from now

  // Schedule notification
  analytics.trackNotificationScheduled(
    notificationId,
    taskId,
    scheduledTime,
    false
  );

  // Later, when notification is delivered...
  // This would be called from notification handler
  const handleNotificationDelivered = (deliveredNotifId: string) => {
    const actualDeliveryTime = Date.now();
    analytics.trackNotificationDelivered(deliveredNotifId, actualDeliveryTime);
  };

  // Or if notification is missed...
  const handleNotificationMissed = (
    missedNotifId: string,
    reason: 'doze_mode' | 'permission_denied' | 'system_error' | 'unknown'
  ) => {
    analytics.trackNotificationMissed(missedNotifId, reason);
  };

  return { handleNotificationDelivered, handleNotificationMissed };
}

/**
 * Example: Tracking sync operations
 */
export async function syncDataExample() {
  const syncId = `sync-${Date.now()}`;

  analytics.trackSyncStart(syncId, 'full');

  try {
    // Perform sync...
    const recordsSynced = 15;

    analytics.trackSyncComplete(syncId, recordsSynced);
  } catch (error) {
    const errorCode = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
    const retryable = true; // Determine if error is retryable

    analytics.trackSyncFail(syncId, errorCode, retryable);
  }
}

/**
 * Example: Tracking conflicts
 */
export function handleConflictExample(
  table: string,
  recordId: string,
  _localVersion: Record<string, unknown>,
  _remoteVersion: Record<string, unknown>
) {
  // Detect conflict
  analytics.trackConflictSeen(
    table,
    recordId,
    'update_update',
    'server_wins' // Default resolution
  );

  // User chooses to restore local version
  const restoreLocalVersion = () => {
    analytics.trackConflictRestored(table, recordId, 'update_update');
    // Restore logic...
  };

  return { restoreLocalVersion };
}

/**
 * Example: Tracking AI suggestions
 */
export async function aiSuggestionExample(plantId: string) {
  const suggestionId = `suggestion-${Date.now()}`;

  // AI detects issue
  analytics.trackAISuggested(
    plantId,
    suggestionId,
    'nutrient_deficiency',
    0.85,
    5,
    'Detected nitrogen deficiency based on leaf yellowing'
  );

  // User applies suggestion
  const applySuggestion = () => {
    analytics.trackAIApplied(
      plantId,
      suggestionId,
      'nutrient_deficiency',
      0.85,
      5,
      true // User found it helpful
    );
  };

  // User declines suggestion
  const declineSuggestion = () => {
    analytics.trackAIDeclined(
      plantId,
      suggestionId,
      'nutrient_deficiency',
      0.85,
      5,
      false // User didn't find it helpful
    );
  };

  return { applySuggestion, declineSuggestion };
}

/**
 * Example: Tracking trichome helper
 */
export function trichomeHelperExample(plantId: string) {
  // User opens trichome helper
  analytics.trackTrichomeHelperOpen(plantId, 'flowering');

  // User logs assessment
  const logAssessment = (
    assessment: 'clear' | 'milky' | 'amber' | 'mixed',
    photoCount: number
  ) => {
    analytics.trackTrichomeHelperLogged(
      plantId,
      assessment,
      photoCount > 0,
      photoCount,
      assessment === 'amber' ? 2 : undefined // Suggest harvest in 2 days
    );
  };

  return { logAssessment };
}

/**
 * Example: Monitoring health at app startup
 */
export function appStartupExample() {
  // Emit summary of metrics
  analytics.emitSummary();

  // Check health status
  const health = analytics.getHealthStatus();

  if (health.overall === 'unhealthy') {
    console.warn('System health is unhealthy:', health.issues);
    // Show alert to user or send to monitoring service
  } else if (health.overall === 'degraded') {
    console.warn('System health is degraded:', health.issues);
  }

  // Get detailed report
  const report = analytics.getMetricsReport();
  console.log(report);

  // Cleanup old notifications
  analytics.cleanupOldNotifications(7 * 24 * 60 * 60 * 1000); // 7 days
}

/**
 * Example: Task customization tracking
 */
export function customizeTaskExample(
  taskId: string,
  plantId: string,
  playbookId: string
) {
  const changedFields = ['title', 'dueDate', 'description'];
  const breaksInheritance = true; // This task won't be affected by bulk operations

  analytics.trackPlaybookTaskCustomized(
    taskId,
    plantId,
    playbookId,
    changedFields,
    breaksInheritance
  );
}

/**
 * Example: Saving custom template
 */
export function saveTemplateExample(
  playbookId: string,
  plantId: string,
  customizationCount: number
) {
  const templateName = 'My Custom Indoor Auto Schedule';

  analytics.trackPlaybookSavedAsTemplate(
    playbookId,
    plantId,
    customizationCount,
    templateName
  );
}
