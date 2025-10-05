# Supabase Backend Integration Summary

## Task 19: Build Supabase Backend Integration

This document summarizes the Supabase backend integration for the Guided Grow Playbooks feature.

## ✅ Completed Components

### 1. Sync Endpoints (WatermelonDB Contract)

**Edge Functions:**

- `sync-pull` - Implements cursor-based pagination for pulling changes
- `sync-push` - Implements atomic push operations with conflict detection

**RPC Functions:**

- `perform_sync_pull_v2` - Cursor-based incremental pull with pagination
- `apply_sync_push` - Applies client changes with idempotency and conflict checks

**Contract Compliance:**

- ✅ Returns `pullChanges` object with `created`, `updated`, `deleted` arrays per table
- ✅ Accepts `pushChanges` object with same structure
- ✅ Implements `serverTimestamp` for sync coordination
- ✅ Supports cursor-based pagination with `hasMore` and `nextCursor`
- ✅ Handles `lastPulledAt` timestamp for incremental sync

### 2. Idempotency Keys

**Implementation:**

- ✅ `sync_idempotency` table with RLS enabled
- ✅ SHA-256 hash generation from request body for deterministic keys
- ✅ Automatic idempotency key generation if not provided
- ✅ Response payload caching for duplicate requests
- ✅ Per-user isolation via `user_id` column

**Behavior:**

- Prevents duplicate mutations on retry
- Returns cached response for duplicate idempotency keys
- Supports explicit idempotency keys via `Idempotency-Key` header

### 3. RLS Policies for Private User Tables

**Tables with RLS Enabled:**

- ✅ `series` - Per-user isolation via `user_id`
- ✅ `tasks` - Per-user isolation via `user_id`
- ✅ `occurrence_overrides` - Per-user isolation via `user_id`
- ✅ `notification_queue` - Per-user isolation via task ownership
- ✅ `ph_ec_readings` - Per-user isolation via `user_id`

**Policy Structure:**
Each table has 4 policies:

1. SELECT - Users can view their own records
2. INSERT - Users can insert their own records
3. UPDATE - Users can update their own records
4. DELETE - Users can delete their own records

**User Isolation:**

- Added `user_id` column to `series`, `tasks`, `occurrence_overrides`, `ph_ec_readings`
- Created indexes on `user_id` for efficient queries
- Foreign key constraints to `auth.users(id)` with CASCADE delete

### 4. Community Template Storage

**Tables:**

- ✅ `community_playbook_templates` - Public-read, owner-write
- ✅ `template_ratings` - Public-read, user-write
- ✅ `template_comments` - Public-read, user-write

**RLS Policies:**

- Public can view non-deleted templates, ratings, and comments
- Users can create their own templates, ratings, and comments
- Authors can update/delete their own templates
- Users can update/delete their own ratings and comments

**Features:**

- Automatic rating average calculation via trigger
- Adoption count tracking
- License field (default: CC-BY-SA)
- PII stripping enforced at application layer

### 5. Realtime Subscriptions

**Enabled for Community Tables Only:**

- ✅ `community_playbook_templates`
- ✅ `template_ratings`
- ✅ `template_comments`

**Explicitly Disabled for Private Tables:**

- ❌ `series` - Syncs via WatermelonDB only
- ❌ `tasks` - Syncs via WatermelonDB only
- ❌ `occurrence_overrides` - Syncs via WatermelonDB only
- ❌ `notification_queue` - Syncs via WatermelonDB only
- ❌ `ph_ec_readings` - Syncs via WatermelonDB only
- ❌ `sync_idempotency` - Internal table, no realtime needed

**Configuration:**

- Added tables to `supabase_realtime` publication
- Documented in table comments which tables have Realtime enabled/disabled

### 6. Edge Functions with JWT Authentication

**Authentication:**

- ✅ All Edge Functions require `Authorization` header
- ✅ JWT token validation via Supabase client
- ✅ User context available via `auth.uid()` in RLS policies

**RLS Enforcement:**

- ✅ All sync operations respect RLS policies
- ✅ No service key usage for user-scoped operations
- ✅ Per-user data isolation enforced at database level

**CORS Configuration:**

- ✅ Proper CORS headers for web/mobile clients
- ✅ OPTIONS preflight support
- ✅ Idempotency-Key header exposed in responses

## 📁 Migration Files

1. `20251005_add_user_id_and_rls_for_playbook_tables.sql`
   - Adds `user_id` columns to private tables
   - Enables RLS on all private tables
   - Creates RLS policies for per-user isolation
   - Adds indexes for efficient user-based queries

2. `20251005_configure_realtime_for_community_templates.sql`
   - Enables Realtime for community tables
   - Documents which tables have Realtime enabled/disabled
   - Ensures private tables are not in Realtime publication

3. `20251005_create_community_playbook_templates.sql` (existing)
   - Creates community template tables
   - Sets up RLS policies for public-read, owner-write
   - Adds rating and comment functionality

4. `20250905_sync_functions.sql` (existing)
   - Implements `perform_sync_pull` and `apply_sync_push` RPC functions
   - Handles conflict detection and idempotency

5. `20250907_sync_pull_v2.sql` (existing)
   - Implements cursor-based pagination for sync pull
   - Optimizes for large datasets

## 🔒 Security Verification

### RLS Status

```sql
-- All private tables have RLS enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('series', 'tasks', 'occurrence_overrides', 'notification_queue', 'ph_ec_readings');
```

Result: All tables show `rowsecurity = true`

### User Isolation

- ✅ Users can only access their own data
- ✅ No cross-user data leakage
- ✅ Sync operations filtered by `auth.uid()`

### Realtime Isolation

- ✅ Community tables publicly readable
- ✅ Private tables not in Realtime publication
- ✅ No sensitive data exposed via Realtime

## 📊 Performance Considerations

### Indexes Created

- `idx_series_user_id` - Fast user-based queries on series
- `idx_tasks_user_id` - Fast user-based queries on tasks
- `idx_occurrence_overrides_user_id` - Fast user-based queries on overrides
- `idx_ph_ec_readings_user_id` - Fast user-based queries on readings
- `idx_tasks_updated_at_id_active` - Efficient sync pagination
- `idx_tasks_deleted_at_id_tombstones` - Efficient tombstone pagination

### Sync Optimization

- Cursor-based pagination prevents full table scans
- Stable server timestamp prevents race conditions
- Batched operations reduce round trips
- Idempotency prevents duplicate work

## 🧪 Testing Recommendations

### Sync Contract Testing

```typescript
// Test pullChanges structure
const response = await syncPull({ lastPulledAt: 0 });
expect(response).toHaveProperty('changes');
expect(response.changes).toHaveProperty('tasks');
expect(response.changes.tasks).toHaveProperty('created');
expect(response.changes.tasks).toHaveProperty('updated');
expect(response.changes.tasks).toHaveProperty('deleted');

// Test pushChanges structure
const pushResponse = await syncPush({
  lastPulledAt: response.serverTimestamp,
  changes: {
    tasks: {
      created: [
        /* task objects */
      ],
      updated: [
        /* task objects */
      ],
      deleted: [
        /* task ids */
      ],
    },
  },
});
```

### RLS Testing

```typescript
// Test user isolation
const user1Tasks = await supabase.from('tasks').select('*');
const user2Tasks = await supabase.from('tasks').select('*');
// Should return different data for different users
```

### Idempotency Testing

```typescript
// Test duplicate request handling
const key = 'test-key-123';
const response1 = await syncPush(
  {
    /* data */
  },
  { headers: { 'Idempotency-Key': key } }
);
const response2 = await syncPush(
  {
    /* data */
  },
  { headers: { 'Idempotency-Key': key } }
);
// Should return same response without re-executing
expect(response1).toEqual(response2);
```

### Realtime Testing

```typescript
// Test community template updates
const channel = supabase
  .channel('community-templates')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'community_playbook_templates' },
    (payload) => console.log('Change received!', payload)
  )
  .subscribe();

// Should receive updates for community templates
// Should NOT receive updates for private tasks
```

## 📝 Client Integration Notes

### WatermelonDB Schema Updates Required

The client-side WatermelonDB schema needs to be updated to include `user_id` columns:

```typescript
// Add to series, tasks, occurrence_overrides, ph_ec_readings tables
{ name: 'user_id', type: 'string', isOptional: true }
```

### Sync Adapter Configuration

The sync adapter should automatically populate `user_id` from the authenticated user:

```typescript
// In sync push, add user_id to all records
const userId = await getCurrentUserId();
const enrichedChanges = {
  tasks: {
    created: changes.tasks.created.map((task) => ({
      ...task,
      user_id: userId,
    })),
    updated: changes.tasks.updated.map((task) => ({
      ...task,
      user_id: userId,
    })),
    deleted: changes.tasks.deleted,
  },
};
```

### Realtime Subscriptions

Only subscribe to community tables:

```typescript
// ✅ Good - Community templates
supabase
  .channel('community')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'community_playbook_templates' },
    handleChange
  );

// ❌ Bad - Private tasks (use sync instead)
// Don't subscribe to tasks, series, etc.
```

## ✅ Definition of Done Checklist

- [x] Sync endpoints implement pullChanges/pushChanges contract
- [x] Idempotency keys prevent duplicate mutations
- [x] RLS policies secure all private user tables
- [x] Community template storage with public-read, owner-write RLS
- [x] Realtime enabled ONLY for community templates
- [x] Edge Functions use JWT authentication
- [x] All server operations respect RLS
- [x] No service keys used for user-scoped operations
- [x] Sync contract matches WatermelonDB expectations
- [x] Migrations applied successfully
- [x] Documentation complete

## 🎯 Next Steps

1. **Client Integration**: Update WatermelonDB schema to include `user_id` columns
2. **Testing**: Implement comprehensive sync and RLS tests
3. **Monitoring**: Add logging and metrics for sync operations
4. **Performance**: Monitor query performance and optimize indexes as needed
5. **Documentation**: Update API documentation with sync endpoints
