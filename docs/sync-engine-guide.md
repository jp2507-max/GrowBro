# Offline-First Sync Engine Guide

## Overview

The GrowBro app uses an offline-first sync engine built on WatermelonDB that ensures data is always available locally and syncs with the server when connectivity is available.

## Architecture

### Core Components

1. **Sync Engine** (`src/lib/sync-engine.ts`)
   - Single entry point: `synchronize()`
   - Implements pullChanges/pushChanges contract
   - Handles pagination with cursor support
   - Manages idempotency keys

2. **Conflict Resolution** (`src/lib/sync/conflict-resolver.ts`)
   - Last-Write-Wins (LWW) strategy
   - Server revision-based comparison
   - User-visible conflict notifications
   - One-tap restore for local versions

3. **Analytics Tracking** (`src/lib/sync/sync-analytics.ts`)
   - Sync latency metrics (sync_latency_ms)
   - Failure rate tracking (sync_fail_rate)
   - Conflict detection and resolution
   - Pending changes queue size

4. **UI Components**
   - `ConflictResolutionModal`: Shows conflicts with diff view
   - `SyncStatusIndicator`: Shows sync progress
   - Conflict resolution hook: `useConflictResolution`

## Key Features

### Offline-First

All data operations work offline:

- Create, update, delete records locally
- Changes are queued automatically
- Sync happens when connectivity returns
- No data loss during offline periods

### Conflict Resolution

When conflicts occur:

1. Server version is applied (LWW)
2. Task is marked with `needsReview` flag
3. User sees conflict notification
4. User can restore local version with one tap
5. Analytics track resolution strategy

### Idempotency

All push operations include idempotency keys:

- Prevents duplicate operations
- Safe to retry failed syncs
- Server deduplicates based on key

### Performance

- Batched operations (max 1000 records per batch)
- Cursor-based pagination for large datasets
- Background thread for database operations
- Efficient change detection

## Usage

### Basic Sync

```typescript
import { synchronize } from '@/lib/sync-engine';

// Perform a sync
const result = await synchronize();
console.log(`Pushed: ${result.pushed}, Applied: ${result.applied}`);
```

### Sync with Retry

```typescript
import { runSyncWithRetry } from '@/lib/sync-engine';

// Sync with automatic retry on failure
const result = await runSyncWithRetry(5); // max 5 attempts
```

### Using Sync Coordinator

```typescript
import { performSync, manualSync } from '@/lib/sync/sync-coordinator';

// Automatic sync with all features
const result = await performSync({
  withRetry: true,
  maxRetries: 5,
  trackAnalytics: true,
});

// Manual sync triggered by user
const result = await manualSync();
```

### Checking Pending Changes

```typescript
import { getPendingChangesCount } from '@/lib/sync-engine';

const count = await getPendingChangesCount();
console.log(`${count} changes pending sync`);
```

### Handling Conflicts

```typescript
import { useConflictResolution } from '@/lib/hooks/use-conflict-resolution';

function MyComponent() {
  const {
    currentConflict,
    hasConflicts,
    resolveConflict,
    dismissConflict,
  } = useConflictResolution();

  if (!hasConflicts) return null;

  return (
    <ConflictResolutionModal
      conflict={currentConflict}
      onResolve={(strategy) => resolveConflict(currentConflict, strategy)}
      onDismiss={() => dismissConflict(currentConflict)}
    />
  );
}
```

## Data Flow

### Push Flow

1. Collect local changes since last checkpoint
2. Batch changes (max 1000 per batch)
3. Send to server with idempotency key
4. Handle 409 conflicts by pulling first
5. Retry push after conflict resolution

### Pull Flow

1. Request changes since last checkpoint
2. Apply server changes to local database
3. Handle pagination if hasMore=true
4. Update checkpoint after successful apply
5. Rehydrate notifications for changed tasks

### Conflict Resolution Flow

1. Detect conflict (server revision > local revision)
2. Apply server version (LWW)
3. Mark task with needsReview flag
4. Show conflict notification to user
5. User chooses: accept server or restore local
6. Track resolution in analytics

## Schema Requirements

### Sync Metadata Fields

All synced tables must include:

```typescript
{
  server_revision: number | null; // Monotonic counter from server
  server_updated_at_ms: number | null; // Server timestamp in ms
  created_at: number; // Client creation time
  updated_at: number; // Client update time
  deleted_at: number | null; // Soft delete timestamp
}
```

### Conflict Detection

Conflicts are detected by comparing:

1. `server_revision` (preferred if available)
2. `server_updated_at_ms` (fallback)
3. Local `_status` field (check for unsynced changes)

## Analytics Events

### Tracked Metrics

- `sync_latency_ms`: Duration of sync operations
- `sync_fail_rate`: Failure rate with error codes
- `sync_success`: Successful sync completions
- `sync_conflict`: Conflict detection and resolution
- `sync_pending_changes`: Queue size
- `sync_checkpoint_age_ms`: Time since last sync
- `sync_payload_size`: Bandwidth usage

### Error Codes

- `network`: Network connectivity issues
- `timeout`: Request timeout (30s)
- `conflict`: Push conflict (409)
- `schema_mismatch`: Migration required
- `permission`: Authentication failure
- `unknown`: Other errors

## Testing

### Unit Tests

```bash
pnpm test sync-engine
```

### E2E Offline Tests

```bash
pnpm test sync-offline-e2e
```

### Flight Mode Test Scenario

1. Go offline (airplane mode)
2. Apply playbook → creates tasks
3. Shift schedule +3 days
4. Customize 5 tasks
5. Mark 10 tasks complete
6. Go online
7. Sync changes
8. Verify on second device

## Best Practices

### Do's

✅ Always use WatermelonDB for data operations
✅ Let sync engine handle conflicts automatically
✅ Track analytics for monitoring
✅ Use retry logic for network operations
✅ Test offline scenarios thoroughly

### Don'ts

❌ Don't bypass WatermelonDB with direct writes
❌ Don't rely on client timestamps for conflicts
❌ Don't block UI during sync operations
❌ Don't ignore conflict notifications
❌ Don't assume sync will always succeed

## Troubleshooting

### Sync Not Working

1. Check network connectivity
2. Verify authentication token
3. Check server endpoint configuration
4. Review sync logs in monitor

### Conflicts Not Resolving

1. Ensure server_revision is set correctly
2. Check conflict resolver strategy
3. Verify LWW logic in sync engine
4. Review conflict analytics

### Performance Issues

1. Check batch sizes (should be ≤1000)
2. Monitor payload sizes
3. Review pagination cursor logic
4. Check database indexes

## Configuration

### Environment Variables

```bash
API_BASE_URL=https://api.growbro.app
EXPO_PUBLIC_API_BASE_URL=https://api.growbro.app
```

### Sync Settings

```typescript
// In sync-engine.ts
const MAX_PUSH_CHUNK_PER_TABLE = 1000;
const REQUEST_TIMEOUT_MS = 30000;
const CHECKPOINT_KEY = 'sync.lastPulledAt';
```

## Monitoring

### Metrics Dashboard

View sync metrics:

```typescript
import { getMetrics } from '@/lib/sync/monitor';

const metrics = getMetrics();
console.log('P50 latency:', metrics.p50);
console.log('P95 latency:', metrics.p95);
console.log('Last sync:', metrics.lastSuccessAt);
```

### Logs

View sync logs:

```typescript
import { getLogs } from '@/lib/sync/monitor';

const logs = getLogs(); // Newest first
logs.forEach((log) => {
  console.log(`[${log.stage}] ${log.message}`);
});
```

## Future Enhancements

- [ ] Selective sync (sync only specific tables)
- [ ] Compression for large payloads
- [ ] Delta sync (only changed fields)
- [ ] Conflict resolution strategies per table
- [ ] Real-time sync with WebSockets
- [ ] Sync priority queue
- [ ] Bandwidth-aware sync

## References

- [WatermelonDB Sync Documentation](https://nozbe.github.io/WatermelonDB/Advanced/Sync.html)
- [RFC 5545 (RRULE)](https://tools.ietf.org/html/rfc5545)
- [Last-Write-Wins Conflict Resolution](https://en.wikipedia.org/wiki/Conflict-free_replicated_data_type)
