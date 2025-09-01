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
