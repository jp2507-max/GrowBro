// Central analytics event schema and helper types
// Add new events here to ensure strong typing across the app.

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
