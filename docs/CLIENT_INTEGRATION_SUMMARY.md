# Client Integration Summary - User ID for RLS

## Overview

Updated the WatermelonDB schema and sync engine to support the new `user_id` columns added to the Supabase backend for Row Level Security (RLS).

## Changes Made

### 1. WatermelonDB Schema Updates

**File:** `src/lib/watermelon-schema.ts`

- **Schema version:** Bumped from 11 to 12
- **Added `user_id` column to:**
  - `series` table
  - `tasks` table
  - `occurrence_overrides` table
  - `ph_ec_readings` table

**Column Definition:**

```typescript
{ name: 'user_id', type: 'string', isOptional: true }
```

### 2. WatermelonDB Migration

**File:** `src/lib/watermelon-migrations.ts`

Added migration from version 11 to 12:

```typescript
{
  toVersion: 12,
  steps: [
    addColumns({
      table: 'series',
      columns: [{ name: 'user_id', type: 'string', isOptional: true }],
    }),
    addColumns({
      table: 'tasks',
      columns: [{ name: 'user_id', type: 'string', isOptional: true }],
    }),
    addColumns({
      table: 'occurrence_overrides',
      columns: [{ name: 'user_id', type: 'string', isOptional: true }],
    }),
    addColumns({
      table: 'ph_ec_readings',
      columns: [{ name: 'user_id', type: 'string', isOptional: true }],
    }),
  ],
}
```

### 3. Sync Engine Updates

**File:** `src/lib/sync-engine.ts`

**Modified `pushChanges` function** to automatically enrich all records with `user_id` before pushing to server:

```typescript
async function pushChanges(lastPulledAt: number | null): Promise<number> {
  const toPush = await collectLocalChanges(lastPulledAt);
  const total = countChanges(toPush);
  if (total === 0) return 0;

  // Get current user ID for RLS
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id;

  // Enrich all records with user_id for RLS
  if (userId) {
    const enrichWithUserId = (records: any[]) =>
      records.map((r) => ({ ...r, user_id: userId }));

    toPush.series.created = enrichWithUserId(toPush.series.created);
    toPush.series.updated = enrichWithUserId(toPush.series.updated);
    toPush.tasks.created = enrichWithUserId(toPush.tasks.created);
    toPush.tasks.updated = enrichWithUserId(toPush.tasks.updated);
    toPush.occurrence_overrides.created = enrichWithUserId(
      toPush.occurrence_overrides.created
    );
    toPush.occurrence_overrides.updated = enrichWithUserId(
      toPush.occurrence_overrides.updated
    );
  }

  // ... rest of push logic
}
```

**Key Features:**

- Automatically gets current user ID from Supabase auth
- Enriches all created and updated records with `user_id`
- Applies to all synced tables: series, tasks, occurrence_overrides
- Gracefully handles cases where user is not authenticated (userId will be undefined)

## How It Works

### Push Flow (Client → Server)

1. **Collect Local Changes:** Gather all created/updated/deleted records since last sync
2. **Get User ID:** Fetch current authenticated user ID from Supabase
3. **Enrich Records:** Add `user_id` to all created and updated records
4. **Send to Server:** Push enriched records to sync-push endpoint
5. **Server RLS:** Backend validates user_id matches auth.uid() via RLS policies

### Pull Flow (Server → Client)

1. **Request Changes:** Client requests changes since last pull
2. **Server Filters:** Backend automatically filters by user_id via RLS
3. **Receive Records:** Client receives only their own records
4. **Apply Locally:** Records (including user_id) are stored in local database

## Security Benefits

### Client-Side

- User ID is automatically populated from authenticated session
- No manual user ID management required
- Consistent user ID across all synced records

### Server-Side (via RLS)

- Database enforces per-user isolation
- Users can only access their own data
- Prevents cross-user data leakage
- No service key usage for user operations

## Migration Path

### For Existing Users

1. **Schema Migration:** WatermelonDB will automatically add `user_id` columns on app update
2. **Existing Records:** Will have `user_id = null` initially
3. **First Sync After Update:**
   - Push: All local changes will be enriched with current user_id
   - Pull: Server will return records filtered by user_id
4. **Gradual Backfill:** As records are updated, they'll get user_id populated

### For New Users

- All records created after this update will have `user_id` populated from the start
- No migration needed

## Testing Recommendations

### Unit Tests

```typescript
describe('Sync Engine - User ID Enrichment', () => {
  test('enriches created records with user_id', async () => {
    // Mock authenticated user
    const mockUserId = 'user-123';
    jest.spyOn(supabase.auth, 'getUser').mockResolvedValue({
      data: { user: { id: mockUserId } },
      error: null,
    });

    // Create local records
    await createLocalTask({ title: 'Test Task' });

    // Trigger sync
    await syncDatabase();

    // Verify push payload includes user_id
    expect(mockPushRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        changes: {
          tasks: {
            created: expect.arrayContaining([
              expect.objectContaining({ user_id: mockUserId }),
            ]),
          },
        },
      })
    );
  });

  test('handles unauthenticated user gracefully', async () => {
    // Mock no user
    jest.spyOn(supabase.auth, 'getUser').mockResolvedValue({
      data: { user: null },
      error: null,
    });

    // Should not crash, just skip enrichment
    await expect(syncDatabase()).resolves.not.toThrow();
  });
});
```

### Integration Tests

1. **Multi-User Isolation:**
   - Create records as User A
   - Switch to User B
   - Verify User B cannot see User A's records

2. **Sync Roundtrip:**
   - Create record locally
   - Push to server
   - Clear local database
   - Pull from server
   - Verify record has user_id populated

3. **Migration Test:**
   - Start with schema v11 (no user_id)
   - Create records
   - Upgrade to schema v12
   - Verify migration adds columns
   - Sync and verify user_id gets populated

## Rollback Plan

If issues arise, rollback is straightforward:

1. **Revert Schema:** Change version back to 11
2. **Revert Sync Engine:** Remove user_id enrichment code
3. **Server-Side:** Disable RLS policies (set to permissive mode)

Note: Existing user_id data in database will remain but be ignored.

## Performance Considerations

### Minimal Overhead

- **User ID Lookup:** Single auth call per sync operation (cached in session)
- **Record Enrichment:** Simple object spread operation, O(n) where n = number of records
- **Network:** Adds ~36 bytes per record (UUID string)

### Optimization

- User ID is fetched once per sync, not per record
- Enrichment happens in-memory before serialization
- No additional database queries

## Monitoring

### Metrics to Track

1. **Sync Success Rate:** Should remain unchanged
2. **Sync Duration:** Minimal increase (<5ms for enrichment)
3. **RLS Policy Performance:** Monitor query times on server
4. **User ID Population Rate:** Track % of records with user_id

### Alerts

- Alert if sync fails due to missing user_id
- Alert if RLS policies block legitimate access
- Alert if user_id mismatch detected

## Documentation Updates

### For Developers

- Updated sync engine documentation
- Added RLS architecture diagram
- Documented user_id enrichment flow

### For Users

- No user-facing changes
- Sync behavior remains transparent
- Performance impact negligible

## Next Steps

1. ✅ Schema updated (v11 → v12)
2. ✅ Migration added
3. ✅ Sync engine updated
4. ⏳ Test on development build
5. ⏳ Monitor sync metrics
6. ⏳ Deploy to staging
7. ⏳ Deploy to production

## Related Files

- `src/lib/watermelon-schema.ts` - Schema definition
- `src/lib/watermelon-migrations.ts` - Migration logic
- `src/lib/sync-engine.ts` - Sync implementation
- `src/lib/auth/user-utils.ts` - User ID utilities
- `supabase/migrations/20251005_add_user_id_and_rls_for_playbook_tables.sql` - Backend RLS
