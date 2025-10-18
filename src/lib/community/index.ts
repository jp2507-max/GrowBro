/**
 * Community feed module exports
 *
 * Provides performance monitoring, health checks, and operational utilities
 * for the community feed feature.
 */

// Metrics tracking
export type { CommunityMetrics } from './metrics-tracker';
export { communityMetrics } from './metrics-tracker';

// Health monitoring
export type { Alert, HealthCheckResult, HealthStatus } from './health-monitor';
export { communityHealth } from './health-monitor';

// React hooks
export type { UseCommunityHealthOptions } from './use-community-health';
export { useCommunityHealth, useHealthSnapshot } from './use-community-health';

// Sentry integration
export {
  addCommunityBreadcrumb,
  captureCommunityError,
  trackCommunityTransaction,
} from './sentry-integration';

// Event handling
export type {
  EventHandlerOptions,
  ShouldApplyParams,
} from './event-deduplicator';
export {
  clearAppliedTimestamps,
  createLikeKey,
  getLastAppliedTimestamp,
  getLikeKey,
  handleRealtimeEvent,
  recordAppliedTimestamp,
  shouldApply,
} from './event-deduplicator';

// Outbox processing
export type { OutboxCounts, OutboxProcessorOptions } from './outbox-processor';
export { OutboxProcessor } from './outbox-processor';

// Real-time connection management
export { RealtimeConnectionManager } from './realtime-manager';
export { createOutboxAdapter } from './use-community-feed-realtime';
