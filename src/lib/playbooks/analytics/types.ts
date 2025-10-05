/**
 * Analytics event type definitions for playbook operations
 */

// Base event structure
export interface BaseAnalyticsEvent {
  timestamp: number;
  sessionId: string;
  userId?: string;
}

// Playbook events
export interface PlaybookApplyEvent extends BaseAnalyticsEvent {
  type: 'playbook_apply';
  playbookId: string;
  plantId: string;
  appliedTaskCount: number;
  durationMs: number;
  jobId: string;
}

export interface PlaybookShiftPreviewEvent extends BaseAnalyticsEvent {
  type: 'playbook_shift_preview';
  plantId: string;
  daysDelta: number;
  affectedTaskCount: number;
  includeCompleted: boolean;
  includeManuallyEdited: boolean;
}

export interface PlaybookShiftApplyEvent extends BaseAnalyticsEvent {
  type: 'playbook_shift_apply';
  plantId: string;
  shiftId: string;
  daysDelta: number;
  affectedTaskCount: number;
  durationMs: number;
}

export interface PlaybookShiftUndoEvent extends BaseAnalyticsEvent {
  type: 'playbook_shift_undo';
  plantId: string;
  shiftId: string;
  restoredTaskCount: number;
  durationMs: number;
}

export interface PlaybookTaskCustomizedEvent extends BaseAnalyticsEvent {
  type: 'playbook_task_customized';
  taskId: string;
  plantId: string;
  playbookId: string;
  changedFields: string[];
  breaksInheritance: boolean;
}

export interface PlaybookSavedAsTemplateEvent extends BaseAnalyticsEvent {
  type: 'playbook_saved_as_template';
  playbookId: string;
  plantId: string;
  customizationCount: number;
  templateName: string;
}

// Notification events
export interface NotificationScheduledEvent extends BaseAnalyticsEvent {
  type: 'notif_scheduled';
  notificationId: string;
  taskId: string;
  scheduledTime: number;
  isExactAlarm: boolean;
}

export interface NotificationDeliveredEvent extends BaseAnalyticsEvent {
  type: 'notif_delivered';
  notificationId: string;
  taskId: string;
  scheduledTime: number;
  actualDeliveryTime: number;
  delayMs: number;
}

export interface NotificationMissedEvent extends BaseAnalyticsEvent {
  type: 'notif_missed';
  notificationId: string;
  taskId: string;
  scheduledTime: number;
  reason: 'doze_mode' | 'permission_denied' | 'system_error' | 'unknown';
}

// Sync events
export interface SyncStartEvent extends BaseAnalyticsEvent {
  type: 'sync_start';
  operation: 'pull' | 'push' | 'full';
}

export interface SyncCompleteEvent extends BaseAnalyticsEvent {
  type: 'sync_complete';
  operation: 'pull' | 'push' | 'full';
  latencyMs: number;
  recordsSynced: number;
}

export interface SyncFailEvent extends BaseAnalyticsEvent {
  type: 'sync_fail';
  operation: 'pull' | 'push' | 'full';
  errorCode: string;
  retryable: boolean;
  latencyMs: number;
}

export interface ConflictSeenEvent extends BaseAnalyticsEvent {
  type: 'conflict_seen';
  table: string;
  recordId: string;
  conflictType: 'update_update' | 'update_delete' | 'delete_update';
  resolution: 'server_wins' | 'client_wins' | 'manual';
}

export interface ConflictRestoredEvent extends BaseAnalyticsEvent {
  type: 'conflict_restored';
  table: string;
  recordId: string;
  conflictType: 'update_update' | 'update_delete' | 'delete_update';
}

// AI suggestion events
export interface AISuggestionEvent extends BaseAnalyticsEvent {
  type: 'ai_suggested' | 'ai_applied' | 'ai_declined';
  plantId: string;
  suggestionId: string;
  rootCause: string;
  confidence: number;
  affectedTaskCount: number;
  reasoning?: string;
  helpfulVote?: boolean;
}

// Trichome helper events
export interface TrichomeHelperOpenEvent extends BaseAnalyticsEvent {
  type: 'trichome_helper_open';
  plantId: string;
  phase: string;
}

export interface TrichomeHelperLoggedEvent extends BaseAnalyticsEvent {
  type: 'trichome_helper_logged';
  plantId: string;
  assessment: 'clear' | 'milky' | 'amber' | 'mixed';
  hasPhoto: boolean;
  photoCount: number;
  harvestWindowAdjustment?: number;
}

// Union type of all events
export type AnalyticsEvent =
  | PlaybookApplyEvent
  | PlaybookShiftPreviewEvent
  | PlaybookShiftApplyEvent
  | PlaybookShiftUndoEvent
  | PlaybookTaskCustomizedEvent
  | PlaybookSavedAsTemplateEvent
  | NotificationScheduledEvent
  | NotificationDeliveredEvent
  | NotificationMissedEvent
  | SyncStartEvent
  | SyncCompleteEvent
  | SyncFailEvent
  | ConflictSeenEvent
  | ConflictRestoredEvent
  | AISuggestionEvent
  | TrichomeHelperOpenEvent
  | TrichomeHelperLoggedEvent;

// Metrics types
export interface NotificationMetrics {
  totalScheduled: number;
  totalDelivered: number;
  totalMissed: number;
  deliveryRate: number;
  averageDelayMs: number;
  lastCalculated: number;
}

export interface SyncMetrics {
  totalSyncs: number;
  successfulSyncs: number;
  failedSyncs: number;
  averageLatencyMs: number;
  failRate: number;
  lastCalculated: number;
}

export interface ConflictMetrics {
  totalConflicts: number;
  resolvedByServer: number;
  resolvedByClient: number;
  manualResolutions: number;
  restoredCount: number;
  lastCalculated: number;
}

// Analytics configuration
export interface AnalyticsConfig {
  enabled: boolean;
  debug: boolean;
  batchSize: number;
  flushIntervalMs: number;
  persistEvents: boolean;
}
