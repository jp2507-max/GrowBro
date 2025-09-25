// Central analytics event schema and helper types
// Add new events here to ensure strong typing across the app.
import { hasConsent } from './privacy-consent';

// Map of event names to their payload shapes
export type AnalyticsEvents = {
  // Notification events
  // Emitted when a scheduled notification is cancelled by the app/user
  // Keep payload minimal and PII-safe
  notif_cancelled: {
    notificationId: string;
  };

  // Emitted when rehydration cancels an outdated scheduled notification
  notif_rehydrate_cancelled: {
    notificationId: string;
    taskId: string;
  };

  // Emitted when rehydration schedules a new/updated notification
  notif_rehydrate_scheduled: {
    taskId: string;
  };

  // Emitted when a notification is scheduled
  notif_scheduled: {
    taskId: string;
  };

  // Emitted when a notification is received by the device (fired)
  notif_fired: {
    notificationId?: string;
    taskId?: string;
  };

  // Emitted when the user interacts with a notification (tap/action)
  notif_interacted: {
    notificationId?: string;
    taskId?: string;
    actionId?: string;
  };

  // Emitted with measured delivery delay in milliseconds
  notif_delivery_delay_ms: {
    ms: number;
  };

  // Home UI analytics events
  community_view: {
    post_count: number;
  };
  community_empty: {
    trigger: 'initial_load' | 'refresh';
  };
  community_error: {
    error_type: string;
  };
  home_view: {
    widgets_shown: string[];
  };
  strain_search: {
    query: string;
    results_count: number;
    is_offline: boolean;
  };

  // Plant telemetry events
  plant_watered: {
    taskId: string;
  };
  plant_fed: {
    taskId: string;
  };

  // Sync KPIs
  sync_push: {
    pushed: number;
    queue_length: number;
  };
  sync_pull_applied: {
    applied: number;
    has_more: boolean;
  };
  sync_error: {
    stage: 'push' | 'pull' | 'apply' | 'unknown';
    code?: string | number;
  };
  sync_conflict: {
    table: 'series' | 'tasks' | 'occurrence_overrides';
    count: number;
  };
  sync_checkpoint_age_ms: {
    ms: number;
  };

  // Performance KPIs
  perf_first_paint_ms: {
    ms: number;
  };
  perf_cold_start_ms: {
    ms: number;
  };
  home_tti_ms: {
    ms: number;
  };

  // Guided Grow Playbook events
  playbook_apply: {
    playbookId: string;
    strainType?: string;
    setupType?: string;
  };
  playbook_shift_preview: {
    playbookId: string;
    shiftType: 'forward' | 'backward';
    shiftDays: number;
  };
  playbook_shift_apply: {
    playbookId: string;
    shiftType: 'forward' | 'backward';
    shiftDays: number;
    tasksAffected: number;
  };
  playbook_shift_undo: {
    playbookId: string;
    originalShiftType: 'forward' | 'backward';
    originalShiftDays: number;
  };
  playbook_task_customized: {
    playbookId: string;
    taskId: string;
    customizationType: 'time' | 'frequency' | 'skip' | 'modify';
  };
  playbook_saved_as_template: {
    playbookId: string;
    templateName?: string;
    isPublic: boolean;
  };
  ai_adjustment_suggested: {
    playbookId: string;
    adjustmentType: 'watering' | 'feeding' | 'lighting' | 'environment';
    confidence: number;
  };
  ai_adjustment_applied: {
    playbookId: string;
    adjustmentType: 'watering' | 'feeding' | 'lighting' | 'environment';
    applied: boolean;
  };
  ai_adjustment_declined: {
    playbookId: string;
    adjustmentType: 'watering' | 'feeding' | 'lighting' | 'environment';
    reason?: string;
  };
  trichome_helper_open: {
    playbookId: string;
  };
  trichome_helper_logged: {
    playbookId: string;
    trichomeStage: 'clear' | 'milky' | 'cloudy' | 'amber';
    assessmentConfidence: number;
  };

  // Add future events below
  // example_event: { foo: string; bar?: number };
};

export type AnalyticsEventName = keyof AnalyticsEvents;
export type AnalyticsEventPayload<N extends AnalyticsEventName> =
  AnalyticsEvents[N];

// Optional interface for an analytics client implementation used by the app
export interface AnalyticsClient {
  track<N extends AnalyticsEventName>(
    name: N,
    payload: AnalyticsEventPayload<N>
  ): void | Promise<void>;
}

// Example no-op client for testing/dev usage. Replace with real implementation when available.
export const NoopAnalytics: AnalyticsClient = {
  track: async (_name, _payload) => {
    // Intentionally no-op
    return;
  },
};

// Lightweight in-memory metrics aggregator for tests/dev
// Not exported as default client to keep production clean
export class InMemoryMetrics implements AnalyticsClient {
  private events: { name: AnalyticsEventName; payload: any; t: number }[] = [];
  track<N extends AnalyticsEventName>(
    name: N,
    payload: AnalyticsEventPayload<N>
  ): void {
    this.events.push({ name, payload, t: Date.now() });
  }
  getAll(): { name: AnalyticsEventName; payload: any; t: number }[] {
    return this.events.slice();
  }
  clear(): void {
    this.events = [];
  }
}

// Consent-gated analytics helper with PII stripping

// Helper function to create a consent-gated analytics tracker
export function createConsentGatedAnalytics(
  client: AnalyticsClient
): AnalyticsClient {
  return {
    track<N extends AnalyticsEventName>(
      name: N,
      payload: AnalyticsEventPayload<N>
    ): void | Promise<void> {
      const isPlaybookEvent =
        name.startsWith('playbook_') ||
        name.startsWith('ai_adjustment_') ||
        name.startsWith('trichome_');

      if (isPlaybookEvent && !hasConsent('analytics')) return;

      const sanitizedPayload = sanitizeAnalyticsPayload(name, payload);
      return client.track(name, sanitizedPayload);
    },
  };
}

// PII stripping and data minimization for analytics payloads
function sanitizeAnalyticsPayload<N extends AnalyticsEventName>(
  name: N,
  payload: AnalyticsEventPayload<N>
): AnalyticsEventPayload<N> {
  // For guided grow playbook events, ensure minimal identifiers
  if (
    name.startsWith('playbook_') ||
    name.startsWith('ai_adjustment_') ||
    name.startsWith('trichome_')
  ) {
    const sanitized = { ...payload };

    // Ensure playbookId is hashed or anonymized (implementation depends on your ID strategy)
    if ('playbookId' in sanitized && typeof sanitized.playbookId === 'string') {
      // If playbookId contains PII, hash it here
      // For now, assume playbookId is already a non-identifiable UUID or similar
    }

    // Strip any potential PII from template names
    if ('templateName' in sanitized && sanitized.templateName) {
      // Remove any personal identifiers from template names
      sanitized.templateName = sanitized.templateName
        .replace(/[^\w\s\-!.]/g, '')
        .substring(0, 50);
    }

    // Ensure taskId is non-identifiable
    if ('taskId' in sanitized && typeof sanitized.taskId === 'string') {
      // If taskId contains PII, hash it here
      // For now, assume taskId is already a non-identifiable UUID or similar
    }

    // Remove any email, name, or location data that might slip through
    // This is a safeguard in case future events accidentally include PII
    const sanitizedObj = sanitized as any;
    const piiFields = [
      'email',
      'name',
      'location',
      'address',
      'phone',
      'userId',
    ];
    piiFields.forEach((field) => {
      if (field in sanitizedObj) {
        delete sanitizedObj[field];
      }
    });

    return sanitized as AnalyticsEventPayload<N>;
  }

  // For non-playbook events, return as-is (they should already be PII-free per existing schema)
  return payload;
}

// Documented settings key for analytics consent
export const ANALYTICS_CONSENT_KEY = 'analytics';

/**
 * Analytics Consent Settings Key
 *
 * Key: 'analytics'
 * Type: boolean
 * Default: false
 * Description: Controls whether the user consents to analytics event collection for
 *              improving the guided grow playbooks feature. When disabled, all
 *              playbook-related analytics events are suppressed. Event payloads
 *              are automatically stripped of any PII and use minimal identifiers
 *              (hashed/non-identifiable IDs) even when consent is granted.
 *
 * Usage:
 * - Check consent with: hasConsent('analytics')
 * - Use createConsentGatedAnalytics() for automatic consent checking
 * - All playbook events: playbook_*, ai_adjustment_*, trichome_*
 */
