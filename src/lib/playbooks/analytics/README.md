# Playbook Analytics & Observability System

Comprehensive analytics and observability system for tracking playbook operations, notification delivery, sync performance, and user interactions.

## Features

- **Structured Event Tracking**: Type-safe event definitions for all playbook operations
- **Notification Metrics**: Track delivery rates, delays, and missed notifications
- **Sync Performance**: Monitor sync latency, failure rates, and conflicts
- **Health Monitoring**: Real-time health status with degradation detection
- **Offline Support**: Events are queued and persisted when offline
- **Privacy-First**: No PII tracking, user-initiated data only

## Quick Start

```typescript
import { analytics } from '@/lib/playbooks/analytics';

// Track playbook application
analytics.trackPlaybookApply(playbookId, plantId, taskCount, durationMs, jobId);

// Track notification delivery
analytics.trackNotificationScheduled(notificationId, taskId, scheduledTime);
analytics.trackNotificationDelivered(notificationId, actualTime);

// Check system health
const health = analytics.getHealthStatus();
if (health.overall === 'unhealthy') {
  console.warn('System health issues:', health.issues);
}
```

## Event Types

### Playbook Operations

- `playbook_apply` - When a playbook is applied to a plant
- `playbook_shift_preview` - When user previews schedule shift
- `playbook_shift_apply` - When schedule shift is applied
- `playbook_shift_undo` - When schedule shift is undone
- `playbook_task_customized` - When individual tasks are modified
- `playbook_saved_as_template` - When custom playbook is saved

### Notification Events

- `notif_scheduled` - When a notification is scheduled
- `notif_delivered` - When a notification is delivered
- `notif_missed` - When a notification fails to deliver

### Sync Events

- `sync_start` - When sync operation starts
- `sync_complete` - When sync completes successfully
- `sync_fail` - When sync fails
- `conflict_seen` - When a sync conflict is detected
- `conflict_restored` - When user restores local version

### AI & Features

- `ai_suggested` - When AI suggests schedule adjustments
- `ai_applied` - When user accepts AI suggestion
- `ai_declined` - When user declines AI suggestion
- `trichome_helper_open` - When trichome helper is accessed
- `trichome_helper_logged` - When trichome assessment is recorded

## Metrics

### Notification Metrics

```typescript
const metrics = analytics.getNotificationMetrics();
// {
//   totalScheduled: 100,
//   totalDelivered: 95,
//   totalMissed: 5,
//   deliveryRate: 0.95,
//   averageDelayMs: 1200,
//   lastCalculated: 1234567890
// }
```

### Sync Metrics

```typescript
const metrics = analytics.getSyncMetrics();
// {
//   totalSyncs: 50,
//   successfulSyncs: 48,
//   failedSyncs: 2,
//   averageLatencyMs: 850,
//   failRate: 0.04,
//   lastCalculated: 1234567890
// }
```

### Conflict Metrics

```typescript
const metrics = analytics.getConflictMetrics();
// {
//   totalConflicts: 10,
//   resolvedByServer: 7,
//   resolvedByClient: 2,
//   manualResolutions: 1,
//   restoredCount: 2,
//   lastCalculated: 1234567890
// }
```

## Health Monitoring

The system provides real-time health status based on metrics:

```typescript
const health = analytics.getHealthStatus();
// {
//   overall: 'healthy' | 'degraded' | 'unhealthy',
//   notifications: 'healthy' | 'degraded' | 'unhealthy',
//   sync: 'healthy' | 'degraded' | 'unhealthy',
//   issues: ['Low notification delivery rate: 92.5%']
// }
```

### Health Thresholds

**Notifications:**

- Healthy: ≥95% delivery rate, <5min average delay
- Degraded: 85-95% delivery rate or 5-10min delay
- Unhealthy: <85% delivery rate or >10min delay

**Sync:**

- Healthy: <10% failure rate, <5s latency
- Degraded: 10-25% failure rate or 5-10s latency
- Unhealthy: >25% failure rate or >10s latency

## Usage Examples

### Playbook Application

```typescript
const startTime = Date.now();

// Apply playbook...
const appliedTaskCount = 25;

analytics.trackPlaybookApply(
  playbookId,
  plantId,
  appliedTaskCount,
  Date.now() - startTime,
  jobId
);
```

### Schedule Shifting

```typescript
// Preview
analytics.trackPlaybookShiftPreview(plantId, daysDelta, affectedTaskCount);

// Apply
const startTime = Date.now();
// ... perform shift
analytics.trackPlaybookShiftApply(
  plantId,
  shiftId,
  daysDelta,
  affectedTaskCount,
  Date.now() - startTime
);

// Undo (within 30 seconds)
analytics.trackPlaybookShiftUndo(
  plantId,
  shiftId,
  restoredTaskCount,
  durationMs
);
```

### Notification Lifecycle

```typescript
// Schedule
analytics.trackNotificationScheduled(notificationId, taskId, scheduledTime);

// Delivered
analytics.trackNotificationDelivered(notificationId, actualDeliveryTime);

// Or missed
analytics.trackNotificationMissed(notificationId, 'doze_mode');
```

### Sync Operations

```typescript
const syncId = `sync-${Date.now()}`;

analytics.trackSyncStart(syncId, 'full');

try {
  // Perform sync...
  analytics.trackSyncComplete(syncId, recordsSynced);
} catch (error) {
  analytics.trackSyncFail(syncId, errorCode, retryable);
}
```

### Conflict Handling

```typescript
// Conflict detected
analytics.trackConflictSeen(table, recordId, 'update_update', 'server_wins');

// User restores local version
analytics.trackConflictRestored(table, recordId, 'update_update');
```

### AI Suggestions

```typescript
// AI makes suggestion
analytics.trackAISuggested(
  plantId,
  suggestionId,
  'nutrient_deficiency',
  0.85,
  5,
  'Detected nitrogen deficiency'
);

// User applies
analytics.trackAIApplied(
  plantId,
  suggestionId,
  rootCause,
  confidence,
  taskCount,
  true
);

// Or declines
analytics.trackAIDeclined(
  plantId,
  suggestionId,
  rootCause,
  confidence,
  taskCount,
  false
);
```

### Trichome Helper

```typescript
// Open helper
analytics.trackTrichomeHelperOpen(plantId, 'flowering');

// Log assessment
analytics.trackTrichomeHelperLogged(
  plantId,
  'milky',
  true, // has photo
  3, // photo count
  2 // harvest window adjustment in days
);
```

## App Startup Integration

```typescript
// In app initialization
function initializeAnalytics() {
  // Emit summary of metrics
  analytics.emitSummary();

  // Check health
  const health = analytics.getHealthStatus();
  if (health.overall !== 'healthy') {
    console.warn('System health:', health.overall, health.issues);
  }

  // Cleanup old data
  analytics.cleanupOldNotifications(7 * 24 * 60 * 60 * 1000); // 7 days
}
```

## Configuration

```typescript
analytics.configure({
  enabled: true,
  debug: __DEV__,
  batchSize: 10,
  flushIntervalMs: 30000,
  persistEvents: true,
});
```

## Maintenance

```typescript
// Flush events immediately
await analytics.flush();

// Reset all metrics (for testing)
analytics.resetMetrics();

// Cleanup old notifications
analytics.cleanupOldNotifications(maxAgeMs);

// Shutdown (on app close)
await analytics.shutdown();
```

## Testing

```typescript
import { analytics } from '@/lib/playbooks/analytics';

describe('My Feature', () => {
  beforeEach(() => {
    analytics.resetMetrics();
  });

  it('should track events', () => {
    analytics.trackPlaybookApply(playbookId, plantId, 10, 100, jobId);

    const metrics = analytics.getAggregatedMetrics();
    // Assert metrics...
  });
});
```

## Privacy & Compliance

- **No PII**: User IDs are anonymized, no personal data tracked
- **Opt-in**: Analytics can be disabled via configuration
- **Local-first**: Events are stored locally and only sent when online
- **Transparent**: All tracked events are documented and type-safe

## Performance

- **Batching**: Events are batched to reduce overhead
- **Async**: All operations are non-blocking
- **Efficient**: Uses MMKV for fast persistent storage
- **Minimal**: Only essential data is tracked

## Architecture

```
analytics/
├── index.ts                    # Public API
├── types.ts                    # Event type definitions
├── service.ts                  # Core analytics service
├── notification-metrics.ts     # Notification tracking
├── sync-metrics.ts            # Sync performance tracking
├── metrics-aggregator.ts      # Health monitoring
└── __tests__/                 # Comprehensive tests
```

## Integration Points

The analytics system integrates with:

- **Sentry**: Error tracking and breadcrumbs
- **MMKV**: Fast persistent storage
- **Supabase**: (Future) Analytics backend
- **React Query**: (Future) Real-time dashboards

## Future Enhancements

- [ ] Real-time analytics dashboard
- [ ] Custom analytics backend integration
- [ ] A/B testing support
- [ ] User cohort analysis
- [ ] Funnel tracking
- [ ] Performance profiling
