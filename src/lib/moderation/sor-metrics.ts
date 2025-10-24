/**
 * SoR Submission Metrics and Monitoring
 *
 * Tracks performance metrics for DSA Transparency Database submissions:
 * - p95 latency tracking
 * - DLQ size monitoring
 * - Circuit breaker state transitions
 * - Submission success/failure counters
 *
 * Requirements: 6.4 (SLA monitoring for DSA submissions)
 */

import type { CircuitState } from './sor-circuit-breaker';

// ============================================================================
// Types
// ============================================================================

export interface SubmissionMetrics {
  totalSubmissions: number;
  successfulSubmissions: number;
  failedSubmissions: number;
  dlqCount: number;
  retryCount: number;
  averageLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  circuitState: CircuitState;
  lastSubmissionTime: Date | null;
}

export interface LatencySample {
  timestamp: Date;
  durationMs: number;
  success: boolean;
}

export interface CircuitStateChange {
  timestamp: Date;
  fromState: CircuitState;
  toState: CircuitState;
}

// ============================================================================
// Constants
// ============================================================================

const MAX_LATENCY_SAMPLES = 1000; // Keep last 1000 samples for percentile calculation
const MAX_STATE_CHANGES = 100; // Keep last 100 state changes

// ============================================================================
// Metrics Collector
// ============================================================================

export class SoRMetricsCollector {
  private totalSubmissions: number = 0;
  private successfulSubmissions: number = 0;
  private failedSubmissions: number = 0;
  private dlqCount: number = 0;
  private retryCount: number = 0;
  private lastSubmissionTime: Date | null = null;
  private currentCircuitState: CircuitState = 'CLOSED';

  private latencySamples: LatencySample[] = [];
  private stateChanges: CircuitStateChange[] = [];

  /**
   * Record a submission attempt with latency.
   */
  recordSubmission(durationMs: number, success: boolean): void {
    this.totalSubmissions++;
    this.lastSubmissionTime = new Date();

    if (success) {
      this.successfulSubmissions++;
    } else {
      this.failedSubmissions++;
    }

    // Add latency sample
    this.latencySamples.push({
      timestamp: new Date(),
      durationMs,
      success,
    });

    // Keep only last MAX_LATENCY_SAMPLES
    if (this.latencySamples.length > MAX_LATENCY_SAMPLES) {
      this.latencySamples.shift();
    }
  }

  /**
   * Record DLQ item.
   */
  recordDLQItem(): void {
    this.dlqCount++;
  }

  /**
   * Record retry attempt.
   */
  recordRetry(): void {
    this.retryCount++;
  }

  /**
   * Record circuit breaker state change.
   */
  recordStateChange(fromState: CircuitState, toState: CircuitState): void {
    this.currentCircuitState = toState;

    this.stateChanges.push({
      timestamp: new Date(),
      fromState,
      toState,
    });

    // Keep only last MAX_STATE_CHANGES
    if (this.stateChanges.length > MAX_STATE_CHANGES) {
      this.stateChanges.shift();
    }
  }

  /**
   * Get current metrics snapshot.
   */
  getMetrics(): SubmissionMetrics {
    const latencies = this.latencySamples
      .map((s) => s.durationMs)
      .sort((a, b) => a - b);

    return {
      totalSubmissions: this.totalSubmissions,
      successfulSubmissions: this.successfulSubmissions,
      failedSubmissions: this.failedSubmissions,
      dlqCount: this.dlqCount,
      retryCount: this.retryCount,
      averageLatencyMs: this.calculateAverage(latencies),
      p95LatencyMs: this.calculatePercentile(latencies, 0.95),
      p99LatencyMs: this.calculatePercentile(latencies, 0.99),
      circuitState: this.currentCircuitState,
      lastSubmissionTime: this.lastSubmissionTime,
    };
  }

  /**
   * Get latency samples for specific time window.
   */
  getLatencySamples(windowMs: number): LatencySample[] {
    const cutoff = Date.now() - windowMs;
    return this.latencySamples.filter(
      (sample) => sample.timestamp.getTime() >= cutoff
    );
  }

  /**
   * Get recent circuit state changes.
   */
  getStateChanges(limit: number = 10): CircuitStateChange[] {
    return this.stateChanges.slice(-limit);
  }

  /**
   * Calculate average from array of numbers.
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    const sum = values.reduce((acc, val) => acc + val, 0);
    return Math.round(sum / values.length);
  }

  /**
   * Calculate percentile from sorted array.
   */
  private calculatePercentile(
    sortedValues: number[],
    percentile: number
  ): number {
    if (sortedValues.length === 0) return 0;

    const index = Math.ceil(sortedValues.length * percentile) - 1;
    return sortedValues[Math.max(0, index)];
  }

  /**
   * Get success rate as percentage.
   */
  getSuccessRate(): number {
    if (this.totalSubmissions === 0) return 0;
    return Math.round(
      (this.successfulSubmissions / this.totalSubmissions) * 100
    );
  }

  /**
   * Get failure rate as percentage.
   */
  getFailureRate(): number {
    if (this.totalSubmissions === 0) return 0;
    return Math.round((this.failedSubmissions / this.totalSubmissions) * 100);
  }

  /**
   * Check if p95 latency exceeds threshold.
   */
  isLatencySLABreached(thresholdMs: number): boolean {
    const metrics = this.getMetrics();
    return metrics.p95LatencyMs > thresholdMs;
  }

  /**
   * Check if DLQ size exceeds threshold.
   */
  isDLQSizeExceeded(threshold: number): boolean {
    return this.dlqCount > threshold;
  }

  /**
   * Reset all metrics (for testing or periodic reset).
   */
  reset(): void {
    this.totalSubmissions = 0;
    this.successfulSubmissions = 0;
    this.failedSubmissions = 0;
    this.dlqCount = 0;
    this.retryCount = 0;
    this.lastSubmissionTime = null;
    this.latencySamples = [];
    this.stateChanges = [];
  }

  /**
   * Export metrics for external monitoring systems.
   */
  exportMetrics(): Record<string, number | string | null> {
    const metrics = this.getMetrics();

    return {
      'sor.submissions.total': metrics.totalSubmissions,
      'sor.submissions.success': metrics.successfulSubmissions,
      'sor.submissions.failed': metrics.failedSubmissions,
      'sor.submissions.success_rate': this.getSuccessRate(),
      'sor.submissions.failure_rate': this.getFailureRate(),
      'sor.dlq.count': metrics.dlqCount,
      'sor.retry.count': metrics.retryCount,
      'sor.latency.average_ms': metrics.averageLatencyMs,
      'sor.latency.p95_ms': metrics.p95LatencyMs,
      'sor.latency.p99_ms': metrics.p99LatencyMs,
      'sor.circuit.state': metrics.circuitState,
      'sor.last_submission': metrics.lastSubmissionTime?.toISOString() || null,
    };
  }
}

// Export singleton instance
export const sorMetrics = new SoRMetricsCollector();

// Export class for testing
export { SoRMetricsCollector as SoRMetricsCollectorClass };
