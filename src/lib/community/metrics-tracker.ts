/**
 * Community feed performance metrics tracker
 *
 * Tracks operational metrics for community feed including:
 * - Real-time latency (P50/P95)
 * - WebSocket reconnection events
 * - Event deduplication drops
 * - Outbox queue depth and status
 * - Undo action usage
 * - Mutation failure rates
 *
 * Requirements: 9.6, 10.5
 */

import { MMKV } from 'react-native-mmkv';

const METRICS_STORAGE_ID = 'community-metrics';
const LATENCY_SAMPLES_KEY = 'latency_samples';
const WS_RECONNECTS_KEY = 'ws_reconnects';
const DEDUPE_DROPS_KEY = 'dedupe_drops';
const OUTBOX_METRICS_KEY = 'outbox_metrics';
const UNDO_ACTIONS_KEY = 'undo_actions';
const MUTATION_FAILURES_KEY = 'mutation_failures';
const LAST_WS_RECONNECT_KEY = 'last_ws_reconnect';
const LAST_RECONCILIATION_KEY = 'last_reconciliation';

const MAX_LATENCY_SAMPLES = 100; // Keep last 100 samples for P50/P95
const METRICS_RETENTION_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface CommunityMetrics {
  realtime_latency_p50: number;
  realtime_latency_p95: number;
  ws_reconnects_per_session: number;
  dedupe_drops_per_min: number;
  outbox_depth: number;
  outbox_pending: number;
  outbox_failed: number;
  undo_usage_rate: number;
  mutation_failure_rate: number;
  last_ws_reconnect_at: number | null;
  last_reconciliation_at: number | null;
}

interface LatencySample {
  timestamp: number;
  latency_ms: number;
}

interface OutboxMetrics {
  depth: number;
  pending: number;
  failed: number;
  confirmed: number;
}

interface TimestampedEvent {
  timestamp: number;
  count: number;
}

class CommunityMetricsTracker {
  private storage: MMKV;

  constructor() {
    this.storage = new MMKV({ id: METRICS_STORAGE_ID });
  }

  /**
   * Add a latency sample for real-time event processing
   * Requirement 9.6: Track event received → UI updated latency
   */
  addLatencySample(latencyMs: number): void {
    const samples = this.getLatencySamples();
    samples.push({
      timestamp: Date.now(),
      latency_ms: latencyMs,
    });

    // Keep only recent samples
    const cutoff = Date.now() - METRICS_RETENTION_MS;
    const recentSamples = samples
      .filter((s) => s.timestamp > cutoff)
      .slice(-MAX_LATENCY_SAMPLES);

    this.storage.set(LATENCY_SAMPLES_KEY, JSON.stringify(recentSamples));
  }

  /**
   * Record a WebSocket reconnection event
   * Requirement 10.5: Track WS reconnects/session
   */
  recordReconnect(): void {
    const current = this.storage.getNumber(WS_RECONNECTS_KEY) || 0;
    this.storage.set(WS_RECONNECTS_KEY, current + 1);
    this.storage.set(LAST_WS_RECONNECT_KEY, Date.now());
  }

  /**
   * Record an event deduplication drop
   * Requirement 10.5: Track dedupe drops/min
   */
  recordDedupeDrop(): void {
    const drops = this.getDedupeDrops();
    drops.push({
      timestamp: Date.now(),
      count: 1,
    });

    // Keep only last hour of data
    const cutoff = Date.now() - 60 * 60 * 1000;
    const recentDrops = drops.filter((d) => d.timestamp > cutoff);

    this.storage.set(DEDUPE_DROPS_KEY, JSON.stringify(recentDrops));
  }

  /**
   * Update outbox queue metrics
   * Requirement 10.5: Track Outbox depth
   */
  updateOutboxMetrics(metrics: OutboxMetrics): void {
    this.storage.set(OUTBOX_METRICS_KEY, JSON.stringify(metrics));
  }

  /**
   * Record an undo action (delete undo or comment delete undo)
   * Requirement 10.5: Track undo usage
   */
  recordUndoAction(success: boolean): void {
    const actions = this.getUndoActions();
    actions.push({
      timestamp: Date.now(),
      count: success ? 1 : 0,
    });

    // Keep only last 24 hours
    const cutoff = Date.now() - METRICS_RETENTION_MS;
    const recentActions = actions.filter((a) => a.timestamp > cutoff);

    this.storage.set(UNDO_ACTIONS_KEY, JSON.stringify(recentActions));
  }

  /**
   * Record a mutation failure
   * Requirement 10.5: Track failed mutations/day (<2%)
   */
  recordMutationFailure(failed: boolean): void {
    const failures = this.getMutationFailures();
    failures.push({
      timestamp: Date.now(),
      count: failed ? 1 : 0,
    });

    // Keep only last 24 hours
    const cutoff = Date.now() - METRICS_RETENTION_MS;
    const recentFailures = failures.filter((f) => f.timestamp > cutoff);

    this.storage.set(MUTATION_FAILURES_KEY, JSON.stringify(recentFailures));
  }

  /**
   * Record successful reconciliation
   */
  recordReconciliation(): void {
    this.storage.set(LAST_RECONCILIATION_KEY, Date.now());
  }

  /**
   * Reset session-based counters (call on app start)
   */
  resetSessionCounters(): void {
    this.storage.set(WS_RECONNECTS_KEY, 0);
  }

  /**
   * Get current metrics snapshot
   * Requirement 9.6, 10.5: Expose all tracked metrics
   */
  getMetrics(): CommunityMetrics {
    const latencySamples = this.getLatencySamples();
    const latencies = latencySamples.map((s) => s.latency_ms);
    const p50 = this.calculatePercentile(latencies, 0.5);
    const p95 = this.calculatePercentile(latencies, 0.95);

    const dedupeDrops = this.getDedupeDrops();
    const dropsPerMin = this.calculateRatePerMinute(dedupeDrops);

    const outbox =
      this.storage.getString(OUTBOX_METRICS_KEY) !== undefined
        ? (JSON.parse(
            this.storage.getString(OUTBOX_METRICS_KEY) as string
          ) as OutboxMetrics)
        : { depth: 0, pending: 0, failed: 0, confirmed: 0 };

    const undoActions = this.getUndoActions();
    const undoRate = this.calculateSuccessRate(undoActions);

    const mutationFailures = this.getMutationFailures();
    const failureRate = this.calculateFailureRate(mutationFailures);

    return {
      realtime_latency_p50: p50,
      realtime_latency_p95: p95,
      ws_reconnects_per_session: this.storage.getNumber(WS_RECONNECTS_KEY) || 0,
      dedupe_drops_per_min: dropsPerMin,
      outbox_depth: outbox.depth,
      outbox_pending: outbox.pending,
      outbox_failed: outbox.failed,
      undo_usage_rate: undoRate,
      mutation_failure_rate: failureRate,
      last_ws_reconnect_at:
        this.storage.getNumber(LAST_WS_RECONNECT_KEY) ?? null,
      last_reconciliation_at:
        this.storage.getNumber(LAST_RECONCILIATION_KEY) ?? null,
    };
  }

  /**
   * Clear all stored metrics (for testing)
   */
  clear(): void {
    this.storage.clearAll();
  }

  // Private helper methods

  private getLatencySamples(): LatencySample[] {
    const data = this.storage.getString(LATENCY_SAMPLES_KEY);
    if (data !== undefined) {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    }
    return [];
  }

  private getDedupeDrops(): TimestampedEvent[] {
    const data = this.storage.getString(DEDUPE_DROPS_KEY);
    if (data !== undefined) {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    }
    return [];
  }

  private getUndoActions(): TimestampedEvent[] {
    const data = this.storage.getString(UNDO_ACTIONS_KEY);
    if (data !== undefined) {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    }
    return [];
  }

  private getMutationFailures(): TimestampedEvent[] {
    const data = this.storage.getString(MUTATION_FAILURES_KEY);
    if (data !== undefined) {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    }
    return [];
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * percentile) - 1;
    return sorted[Math.max(0, index)] || 0;
  }

  private calculateRatePerMinute(events: TimestampedEvent[]): number {
    if (events.length === 0) return 0;

    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    const recentEvents = events.filter((e) => e.timestamp > oneMinuteAgo);

    return recentEvents.reduce((sum, e) => sum + e.count, 0);
  }

  private calculateSuccessRate(events: TimestampedEvent[]): number {
    if (events.length === 0) return 0;

    const successful = events.reduce((sum, e) => sum + e.count, 0);
    return successful / events.length;
  }

  private calculateFailureRate(events: TimestampedEvent[]): number {
    if (events.length === 0) return 0;

    const failed = events.filter((e) => e.count === 1).length;
    return failed / events.length;
  }
}

// Singleton instance
export const communityMetrics = new CommunityMetricsTracker();
