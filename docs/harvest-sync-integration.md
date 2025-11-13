# Harvest Workflow Sync Integration

**Status:** ✅ Implemented  
**Version:** 1.0  
**Last Updated:** October 7, 2025

## Overview

This document describes the integration of the harvest workflow tables (`harvests`, `inventory`, `harvest_audits`) into GrowBro's existing offline-first sync engine. The implementation extends the WatermelonDB-based sync infrastructure to support post-harvest tracking with reliable conflict resolution and telemetry.

## Architecture

### Tables Integrated

1. **harvests** - Main harvest workflow tracking (stage progression, weights, photos)
2. **inventory** - Final inventory records (created atomically on curing completion)
3. **harvest_audits** - Audit trail for stage transitions, overrides, and reverts

### Sync Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Offline-First Sync                        │
│                                                              │
│  Local Changes (WatermelonDB)                               │
│         │                                                    │
│         ├─→ collectLocalChanges()                           │
│         │   ├─ series, tasks, occurrence_overrides          │
│         │   └─ harvests, inventory, harvest_audits ✨       │
│         │                                                    │
│         ├─→ pushChanges() with user_id enrichment          │
│         │   ├─ Push order: created → updated → deleted      │
│         │   └─ Idempotency via UUID keys                    │
│         │                                                    │
│         ├─→ pullChanges() with pagination                  │
│         │   └─ Server timestamp as checkpoint               │
│         │                                                    │
│         ├─→ applyServerChanges()                           │
│         │   ├─ Last-Write-Wins (server updated_at)         │
│         │   ├─ Mark conflict_seen=true on conflicts        │
│         │   └─ Invalidate React Query caches               │
│         │                                                    │
│         └─→ React Query cache invalidation                 │
│             ├─ ['tasks'], ['series']                        │
│             ├─ ['harvests'] ✨                             │
│             └─ ['inventory'] ✨                            │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Details

### 1. Type Definitions

**Extended `TableName` union:**

```typescript
type TableName =
  | 'series'
  | 'tasks'
  | 'occurrence_overrides'
  | 'harvests' // ✨ New
  | 'inventory' // ✨ New
  | 'harvest_audits'; // ✨ New
```

**Updated `ChangesByTable`:**

```typescript
type ChangesByTable = Record<TableName, ChangesForTable>;
```

### 2. Data Collection

The `collectLocalChanges()` function extracts pending changes for all tables since the last checkpoint:

```typescript
async function collectLocalChanges(
  lastPulledAt: number | null
): Promise<ChangesByTable> {
  const repos = getAllRepos(); // Includes harvest collections

  // Fetch all rows from all tables
  const [taskRows, seriesRows, ..., harvestRows, inventoryRows, auditRows]
    = await Promise.all([...]);

  // Bucket rows into created/updated/deleted based on checkpoint
  for (const r of harvestRows)
    bucketRowIntoChanges({ table: 'harvests', row: r, lastPulledAt, changes });
  for (const r of inventoryRows)
    bucketRowIntoChanges({ table: 'inventory', row: r, lastPulledAt, changes });
  for (const r of auditRows)
    bucketRowIntoChanges({ table: 'harvest_audits', row: r, lastPulledAt, changes });

  return changes;
}
```

**Logic:**

- Rows with `deletedAt > lastPulledAt` → tombstone (`deleted`)
- Rows with `createdAt > lastPulledAt` → new record (`created`)
- Rows with `updatedAt > lastPulledAt` AND not created → modified (`updated`)

### 3. Push Changes (Local → Server)

**User ID Enrichment for RLS:**

```typescript
async function pushChanges(lastPulledAt: number | null): Promise<number> {
  const toPush = await collectLocalChanges(lastPulledAt);
  const userId = (await supabase.auth.getUser()).data.user?.id;

  if (userId) {
    const enrichWithUserId = (records: any[]) =>
      records.map((r) => ({ ...r, user_id: userId }));

    // Enrich harvest tables
    toPush.harvests.created = enrichWithUserId(toPush.harvests.created);
    toPush.harvests.updated = enrichWithUserId(toPush.harvests.updated);
    toPush.inventory.created = enrichWithUserId(toPush.inventory.created);
    toPush.inventory.updated = enrichWithUserId(toPush.inventory.updated);
    toPush.harvest_audits.created = enrichWithUserId(
      toPush.harvest_audits.created
    );
    toPush.harvest_audits.updated = enrichWithUserId(
      toPush.harvest_audits.updated
    );
  }

  // Send batched push requests
  const batches = buildPushBatches(toPush, lastPulledAt);
  for (const batch of batches) {
    await sendPushBatch(batch, token);
  }
}
```

**Key Features:**

- Batches limited to 1,000 records per table per request (`MAX_PUSH_CHUNK_PER_TABLE`)
- Idempotency via `Idempotency-Key` header (UUID)
- Automatic retry with exponential backoff for transient errors
- Analytics tracking for push metrics (queued mutations, payload size)

### 4. Pull Changes (Server → Local)

```typescript
async function pullAllChanges(lastPulledAt: number | null): Promise<{
  serverTimestamp: number;
  applied: number;
  changedTaskIds: string[];
}> {
  // Pull with pagination
  while (resp.hasMore) {
    resp = await pullChangesOnce({ lastPulledAt, schemaVersion, cursor });
    await applyServerChanges(resp);
    cursor = resp.nextCursor;
  }

  return { serverTimestamp, applied, changedTaskIds };
}
```

### 5. Conflict Resolution (Last-Write-Wins)

**Strategy:**

- Server `updated_at` timestamp is authoritative
- Conflicts detected by comparing local vs. server timestamps
- `conflict_seen=true` flag set on affected records
- UI shows "Updated elsewhere — review changes" banner for `harvests` table

**Resolution Logic:**

```typescript
function determineServerAuthority(localData, serverData): boolean {
  // Prefer server_revision if present
  if (serverData.rev != null && localData.rev != null) {
    return Number(serverData.rev) > Number(localData.rev);
  }

  // Fallback to server_updated_at_ms
  if (serverData.serverTs != null && localData.serverTs != null) {
    return Number(serverData.serverTs) > Number(localData.serverTs);
  }

  return true; // Default to server when timestamps missing
}
```

**Conflict Handling:**

```typescript
async function handleUpdate(table: TableName, existing: any, payload: any): Promise<void> {
  const serverIsAuthoritative = determineServerAuthority(...);
  const hasUnsyncedRecord = existing._raw._status !== 'synced';

  await existing.update((rec: any) => {
    // Mark for review if server is newer and conflicts with unsynced local changes
    if (serverIsAuthoritative && hasUnsyncedRecord) {
      maybeMarkNeedsReview(table, rec, payload);
    }

    // Apply server changes if authoritative
    if (serverIsAuthoritative) {
      applyServerPayloadToRecord(rec, payload);
    }
  });
}
```

**Conflict Strategy by Table:**

```typescript
function getResolutionStrategy(
  tableName: Conflict['tableName']
): ResolutionStrategy {
  // Harvest tables use needs-review to ensure data integrity visibility
  if (tableName === 'tasks' || tableName === 'harvests') return 'needs-review';
  return 'server-lww';
}
```

### 6. React Query Integration

**Cache Invalidation:**

```typescript
export async function runSyncWithRetry(maxAttempts = 5): Promise<SyncResult> {
  const result = await synchronize();

  // Invalidate relevant query keys
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['tasks'] }),
    queryClient.invalidateQueries({ queryKey: ['series'] }),
    queryClient.invalidateQueries({ queryKey: ['occurrence_overrides'] }),
    queryClient.invalidateQueries({ queryKey: ['harvests'] }), // ✨
    queryClient.invalidateQueries({ queryKey: ['inventory'] }), // ✨
  ]);

  return result;
}
```

**Write Path:**

- All mutations go through WatermelonDB (not React Query mutations)
- React Query used only for server state caching and queries
- Ensures offline-first architecture remains consistent

### 7. Telemetry & Analytics

**Existing Infrastructure:**
The harvest sync reuses the existing telemetry system with opt-in consent and PII minimization:

```typescript
// Tracked via sync-analytics.ts
await trackSyncLatency('push', durationMs);
await trackSyncSuccess({ pushed, applied, durationMs });
await trackConflict({
  tableName: TABLE_NAMES.HARVESTS,
  conflictFields,
  resolution,
});
await trackPendingChanges(count);
await trackCheckpointAge(ageMs);
```

**Privacy Compliance:**

- Opt-in consent via `privacy-consent.ts` (`analytics: boolean`)
- EU users: default-off, explicit consent required
- PII minimization: scrub `user_id`, plant names, location data
- 90-day retention policy with automatic purge
- Immediate purge on opt-out

**Metrics Collected (when opted in):**

- Sync duration (push/pull/apply/total)
- Checkpoint age (time since last sync)
- Queued mutations count per table
- Rejection rate and error codes
- Conflict detection and resolution outcomes

### 8. Error Handling

**Error Classification:**

```typescript
categorizeSyncError(err): {
  code: 'network' | 'timeout' | 'conflict' | 'schema_mismatch' | 'permission' | 'unknown';
  retryable: boolean;
  message: string;
}
```

**Retry Strategy:**

- Exponential backoff: 1s → 2s → 4s → 8s → 16s
- Max 5 attempts by default
- Non-retryable errors fail immediately (schema mismatch, permissions)
- Transient errors (network, timeout) trigger automatic retry

**User Feedback:**

- Toast notifications for transient sync errors
- Persistent banner for repeated failures with "Retry now" action
- Conflict banner: "Updated elsewhere — review changes" (when `conflict_seen=true`)

## Database Schema

### Harvests Table

```sql
CREATE TABLE harvests (
  id UUID PRIMARY KEY,
  plant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  stage TEXT NOT NULL, -- 'harvest' | 'drying' | 'curing' | 'inventory'
  wet_weight_g INTEGER,
  dry_weight_g INTEGER,
  trimmings_weight_g INTEGER,
  notes TEXT,
  stage_started_at TIMESTAMPTZ NOT NULL,
  stage_completed_at TIMESTAMPTZ,
  photos JSONB, -- Array of URIs
  server_revision INTEGER,
  server_updated_at_ms BIGINT,
  conflict_seen BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_harvests_user_updated ON harvests(user_id, updated_at);
CREATE INDEX idx_harvests_plant ON harvests(plant_id);
CREATE INDEX idx_harvests_stage ON harvests(stage) WHERE deleted_at IS NULL;
```

### Inventory Table

```sql
CREATE TABLE inventory (
  id UUID PRIMARY KEY,
  plant_id UUID NOT NULL,
  harvest_id UUID NOT NULL UNIQUE,
  user_id UUID NOT NULL,
  final_weight_g INTEGER NOT NULL,
  harvest_date DATE NOT NULL,
  total_duration_days INTEGER NOT NULL,
  server_revision INTEGER,
  server_updated_at_ms BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_inventory_user_updated ON inventory(user_id, updated_at);
CREATE INDEX idx_inventory_plant ON inventory(plant_id);
```

### Harvest Audits Table

```sql
CREATE TABLE harvest_audits (
  id UUID PRIMARY KEY,
  harvest_id UUID NOT NULL,
  user_id UUID NOT NULL,
  operation_type TEXT NOT NULL, -- 'stage_advance' | 'stage_undo' | 'stage_revert' | 'stage_override_skip' | 'sync_rejected'
  from_stage TEXT,
  to_stage TEXT,
  reason TEXT,
  performed_at TIMESTAMPTZ NOT NULL,
  server_revision INTEGER,
  server_updated_at_ms BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_harvest_audits_harvest ON harvest_audits(harvest_id);
CREATE INDEX idx_harvest_audits_user_updated ON harvest_audits(user_id, updated_at);
```

## RLS Policies

All harvest tables use owner-only RLS policies with both `USING` and `WITH CHECK` clauses:

```sql
ALTER TABLE harvests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own harvests" ON harvests
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own inventory" ON inventory
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE harvest_audits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own audit entries" ON harvest_audits
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

## Testing Strategy

### Unit Tests (Pending - Task 11, 15)

**sync-engine.test.ts:**

- ✅ Test harvest table collection in `collectLocalChanges()`
- ✅ Test user_id enrichment in `pushChanges()`
- ✅ Test harvest table upserts/deletes in `applyServerChanges()`
- ✅ Test conflict_seen flag setting on harvest conflicts
- ✅ Test React Query cache invalidation for harvest keys

**conflict-resolver.test.ts:**

- ✅ Test `harvests` table uses `needs-review` strategy
- ✅ Test conflict detection for harvest records
- ✅ Test LWW comparison with server_revision and server_updated_at_ms

**Integration Tests:**

- Flight-mode end-to-end: create harvest offline, sync online, verify server state
- Conflict scenario: modify same harvest on two devices, sync both, verify resolution
- Atomic inventory: complete curing offline, sync, verify inventory + harvest updated

### Manual Testing Checklist

- [ ] Create harvest offline, go online, verify sync
- [ ] Modify harvest online, sync to device, verify conflict_seen banner
- [ ] Complete curing stage, verify inventory created and synced
- [ ] Force conflict (modify same harvest on 2 devices), verify LWW resolution
- [ ] Test sync with 1000+ harvest records (pagination)
- [ ] Test sync retry on network failure
- [ ] Verify telemetry opt-in/opt-out behavior
- [ ] Verify RLS policies prevent cross-user access

## Performance Considerations

**Optimizations:**

- Indexed queries on `(user_id, updated_at)` for efficient incremental pulls
- Batched operations (max 1,000 records per table per request)
- Pagination for large datasets via `nextCursor`
- Selective React Query invalidation (only relevant keys)

**Monitoring:**

- Sync duration metrics (push/pull/apply/total)
- Checkpoint age tracking (time since last sync)
- Rejection rate per table
- Conflict frequency per table

## Migration Path

### Existing Users

For users upgrading from a version without harvest sync:

1. **Schema Migration:** Applied via WatermelonDB migrations (schema version 15)
2. **Initial Sync:** First sync after upgrade pulls all existing harvest data
3. **Checkpoint:** New users start with `lastPulledAt = null` (full sync)
4. **Backward Compat:** Server continues to support older clients for core tables

### Rollback Plan

If critical issues arise:

1. Revert sync-engine changes (remove harvest tables from `SYNC_TABLES`)
2. Harvest data remains in local DB (no data loss)
3. Users can continue offline operations
4. Re-enable sync after hotfix

## Future Enhancements

### Planned (Next Release)

- [ ] **Selective Sync:** Allow users to sync only recent harvests (e.g., last 6 months)
- [ ] **Conflict UI:** Build visual diff viewer for harvest conflicts
- [ ] **Batch Upload:** Optimize photo upload with background queue
- [ ] **Sync Status Indicator:** Real-time sync progress in harvest list
- [ ] **Field-Level Conflicts:** Show specific field differences in conflict banner

### Under Consideration

- [ ] **Delta Sync:** Send only changed fields instead of full records
- [ ] **Compression:** Gzip large payloads (photos, notes)
- [ ] **Offline Indicators:** Visual cues for unsynced harvests in UI
- [ ] **Manual Conflict Resolution:** Allow users to choose server/local version per field

## Troubleshooting

### Common Issues

**1. Sync Stuck / Not Progressing**

- Check `sync.lastPulledAt` in storage (MMKV)
- Verify network connectivity
- Check Supabase RLS policies allow `SELECT` on harvest tables
- Review logs for `SyncSchemaMismatchError`

**2. Conflict Banner Not Showing**

- Verify `conflict_seen` field is `true` in local DB
- Check harvest table uses `needs-review` strategy in conflict-resolver.ts
- Ensure UI checks `harvest.conflict_seen` before rendering banner

**3. Harvest Not Syncing**

- Verify `user_id` is enriched in push payload
- Check RLS policies on server
- Ensure harvest record has `updatedAt > lastPulledAt`
- Review `sync_push` analytics events for rejection count

**4. Photos Not Syncing**

- Photos sync via separate Supabase Storage upload queue
- Check `image_upload_queue` table for pending uploads
- Verify Supabase Storage bucket RLS policies
- See Task 6.1 for photo upload implementation details

## Related Documentation

- [Sync Engine Guide](./sync-engine-guide.md) - General sync architecture
- [Harvest Workflow Design](../.kiro/specs/14. harvest-workflow/design.md) - Full spec
- [Privacy & Telemetry](./sentry-privacy-configuration.md) - Consent management
- [WatermelonDB Schema](../src/lib/watermelon-schema.ts) - Database schema

## References

- **Requirements:** 7.1-7.3, 12.1-12.10 (offline sync, conflict resolution, telemetry)
- **Design:** `design.md` lines 36-52 (Data Flow Architecture), 390-470 (Sync API)
- **Implementation:** `src/lib/sync-engine.ts` (harvest tables integrated)
- **Analytics:** `src/lib/sync/sync-analytics.ts` (telemetry with PII minimization)
- **Conflict Resolution:** `src/lib/sync/conflict-resolver.ts` (LWW + needs-review)

---

**Last Review:** October 7, 2025  
**Next Review:** After Task 15 (comprehensive test suite)
