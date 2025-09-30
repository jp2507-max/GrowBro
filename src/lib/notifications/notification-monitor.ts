/**
 * Notification Performance Monitoring Service
 *
 * Tracks notification delivery latency, performance metrics, and alerts for
 * delivery rate threshold violations. Provides p50/p95 latency calculations
 * and monitoring for the 5-second community notification delivery target.
 *
 * Platform limitations:
 * - iOS: No per-device delivery receipts (Apple Push Console aggregates only)
 * - Android: Dismissal tracking via deleteIntent; iOS has no dismissal callback
 * - Expo: Receipts report handoff to FCM/APNs, not final device delivery
 */

import { getItem, setItem } from '@/lib/storage';

export type NotificationStage =
  | 'request_created'
  | 'sent_to_expo'
  | 'delivered_to_device'
  | 'opened_by_user'
  | 'dismissed_by_user';

export interface LatencyRecord {
  messageId: string;
  type: string;
  platform: 'ios' | 'android';
  requestCreatedAt: number;
  sentToExpoAt?: number;
  deliveredToDeviceAt?: number;
  openedByUserAt?: number;
  dismissedByUserAt?: number;
}

export interface NotificationMetrics {
  // Latency metrics (milliseconds)
  latency: {
    requestToSent: { p50: number | null; p95: number | null };
    sentToDelivered: { p50: number | null; p95: number | null };
    deliveredToOpened: { p50: number | null; p95: number | null };
    endToEnd: { p50: number | null; p95: number | null };
  };
  // Performance targets
  targets: {
    endToEndTarget: number; // 5000ms for community notifications
    deliveryRateThreshold: number; // 95%
  };
  // Current performance
  current: {
    avgEndToEndLatency: number | null;
    deliveryRatePercent: number | null;
    targetViolations: number;
  };
  // Alerts
  alerts: {
    slowDeliveries: number;
    belowThreshold: boolean;
  };
}

const MAX_RECORDS = 500; // Keep last 500 latency records
const END_TO_END_TARGET_MS = 5000; // 5 seconds for community notifications
const DELIVERY_RATE_THRESHOLD = 95.0; // 95% delivery rate target

let latencyRecords: LatencyRecord[] = [];

/**
 * Initialize a new latency record when notification request is created
 */
export function initLatencyRecord(
  messageId: string,
  type: string,
  platform: 'ios' | 'android'
): void {
  const record: LatencyRecord = {
    messageId,
    type,
    platform,
    requestCreatedAt: Date.now(),
  };

  latencyRecords.push(record);

  // Keep only recent records
  if (latencyRecords.length > MAX_RECORDS) {
    latencyRecords = latencyRecords.slice(-MAX_RECORDS);
  }
}

/**
 * Record when notification was sent to Expo Push Service
 */
export function recordSentToExpo(messageId: string): void {
  const record = latencyRecords.find((r) => r.messageId === messageId);
  if (record) {
    record.sentToExpoAt = Date.now();
  }
}

/**
 * Record when notification was delivered to device
 * Note: Platform limitations apply - this may represent Expo receipt, not device delivery
 */
export function recordDeliveredToDevice(messageId: string): void {
  const record = latencyRecords.find((r) => r.messageId === messageId);
  if (record) {
    record.deliveredToDeviceAt = Date.now();
  }
}

/**
 * Record when user opened the notification
 */
export function recordOpenedByUser(messageId: string): void {
  const record = latencyRecords.find((r) => r.messageId === messageId);
  if (record) {
    record.openedByUserAt = Date.now();
  }
}

/**
 * Record when user dismissed the notification (Android only)
 */
export function recordDismissedByUser(messageId: string): void {
  const record = latencyRecords.find((r) => r.messageId === messageId);
  if (record && record.platform === 'android') {
    record.dismissedByUserAt = Date.now();
  }
}

/**
 * Calculate percentile from array of values
 */
function percentile(values: number[], p: number): number | null {
  if (!values || values.length === 0) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor((p / 100) * sorted.length))
  );
  return sorted[idx];
}

/**
 * Calculate latency between two stages
 */
function calculateStageLatencies(
  records: LatencyRecord[],
  startField: keyof LatencyRecord,
  endField: keyof LatencyRecord
): number[] {
  return records
    .filter(
      (r) =>
        typeof r[startField] === 'number' && typeof r[endField] === 'number'
    )
    .map((r) => (r[endField] as number) - (r[startField] as number))
    .filter((latency) => latency >= 0 && latency < 60000); // Reasonable range: 0-60s
}

/**
 * Calculate delivery rate metrics
 */
function calculateDeliveryMetrics(records: LatencyRecord[]): {
  deliveryRatePercent: number | null;
  belowThreshold: boolean;
} {
  const totalCreated = records.length;
  const totalOpened = records.filter(
    (r) => typeof r.openedByUserAt === 'number'
  ).length;
  const deliveryRatePercent =
    totalCreated > 0 ? (totalOpened / totalCreated) * 100 : null;

  const belowThreshold =
    deliveryRatePercent !== null &&
    deliveryRatePercent < DELIVERY_RATE_THRESHOLD;

  return {
    deliveryRatePercent:
      deliveryRatePercent !== null
        ? Math.round(deliveryRatePercent * 100) / 100
        : null,
    belowThreshold,
  };
}

/**
 * Calculate target violations for community notifications
 */
function calculateTargetViolations(records: LatencyRecord[]): number {
  const communityRecords = records.filter((r) =>
    r.type.startsWith('community.')
  );
  const communityEndToEndLatencies = calculateStageLatencies(
    communityRecords,
    'requestCreatedAt',
    'openedByUserAt'
  );
  return communityEndToEndLatencies.filter(
    (latency) => latency > END_TO_END_TARGET_MS
  ).length;
}

/**
 * Calculate all stage latencies
 */
function calculateAllLatencies(records: LatencyRecord[]): {
  requestToSent: number[];
  sentToDelivered: number[];
  deliveredToOpened: number[];
  endToEnd: number[];
} {
  return {
    requestToSent: calculateStageLatencies(
      records,
      'requestCreatedAt',
      'sentToExpoAt'
    ),
    sentToDelivered: calculateStageLatencies(
      records,
      'sentToExpoAt',
      'deliveredToDeviceAt'
    ),
    deliveredToOpened: calculateStageLatencies(
      records,
      'deliveredToDeviceAt',
      'openedByUserAt'
    ),
    endToEnd: calculateStageLatencies(
      records,
      'requestCreatedAt',
      'openedByUserAt'
    ),
  };
}

/**
 * Get notification performance metrics
 */
export function getNotificationMetrics(): NotificationMetrics {
  const latencies = calculateAllLatencies(latencyRecords);

  const avgEndToEndLatency =
    latencies.endToEnd.length > 0
      ? Math.round(
          latencies.endToEnd.reduce((sum, val) => sum + val, 0) /
            latencies.endToEnd.length
        )
      : null;

  const targetViolations = calculateTargetViolations(latencyRecords);
  const deliveryMetrics = calculateDeliveryMetrics(latencyRecords);

  const slowDeliveries = latencies.endToEnd.filter(
    (latency) => latency > END_TO_END_TARGET_MS
  ).length;

  return {
    latency: {
      requestToSent: {
        p50: percentile(latencies.requestToSent, 50),
        p95: percentile(latencies.requestToSent, 95),
      },
      sentToDelivered: {
        p50: percentile(latencies.sentToDelivered, 50),
        p95: percentile(latencies.sentToDelivered, 95),
      },
      deliveredToOpened: {
        p50: percentile(latencies.deliveredToOpened, 50),
        p95: percentile(latencies.deliveredToOpened, 95),
      },
      endToEnd: {
        p50: percentile(latencies.endToEnd, 50),
        p95: percentile(latencies.endToEnd, 95),
      },
    },
    targets: {
      endToEndTarget: END_TO_END_TARGET_MS,
      deliveryRateThreshold: DELIVERY_RATE_THRESHOLD,
    },
    current: {
      avgEndToEndLatency,
      deliveryRatePercent: deliveryMetrics.deliveryRatePercent,
      targetViolations,
    },
    alerts: {
      slowDeliveries,
      belowThreshold: deliveryMetrics.belowThreshold,
    },
  };
}

/**
 * Clear all latency records (for testing)
 */
export function clearLatencyRecords(): void {
  latencyRecords = [];
}

/**
 * Get all latency records (for debugging)
 */
export function getLatencyRecords(): LatencyRecord[] {
  return latencyRecords.slice();
}

/**
 * Mark last successful notification send
 */
export async function markNotificationSuccess(): Promise<void> {
  await setItem('notifications.lastSuccessAt', Date.now());
}

/**
 * Get last successful notification timestamp
 */
export function getLastNotificationSuccess(): number | null {
  return getItem<number>('notifications.lastSuccessAt');
}

/**
 * Mark last failed notification with error
 */
export async function markNotificationFailure(error: string): Promise<void> {
  await setItem('notifications.lastFailureAt', Date.now());
  await setItem('notifications.lastFailureError', error);
}

/**
 * Get last failure information
 */
export function getLastNotificationFailure(): {
  timestamp: number | null;
  error: string | null;
} {
  return {
    timestamp: getItem<number>('notifications.lastFailureAt'),
    error: getItem<string>('notifications.lastFailureError'),
  };
}
