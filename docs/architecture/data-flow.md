# Data Flow Architecture

## Overview

GrowBro uses an **offline-first** architecture with clear separation of concerns between read and write operations.

## Key Principles

### 1. Single Source of Truth: WatermelonDB

All persistent data is stored in **WatermelonDB** (local SQLite database). This ensures:

- ✅ Offline-first by default
- ✅ Consistent data model across the app
- ✅ Atomic transactions and relationships
- ✅ Efficient queries with indexing

### 2. Read Operations: React Query

**React Query** is used ONLY for:

- ✅ Server state caching (read operations)
- ✅ API response memoization
- ✅ Stale-while-revalidate patterns
- ✅ Loading/error state management

**NOT used for**:

- ❌ Data mutations (use WatermelonDB)
- ❌ Persistent mutations (no persistQueryClient)
- ❌ Local state management (use Zustand)

### 3. Write Operations: WatermelonDB → Sync Engine

All data writes follow this pattern:

```typescript
// ✅ CORRECT: Write to WatermelonDB
await database.write(async () => {
  await harvestsCollection.create((harvest) => {
    harvest.wetWeight = 1000;
    harvest.userId = currentUserId;
  });
});

// ❌ INCORRECT: React Query mutation
const mutation = useMutation({
  mutationFn: (data) => api.createHarvest(data), // NO!
});
```

### 4. Sync Flow

```
┌─────────────────┐
│  User Action    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  WatermelonDB   │ ◄── Single source of truth
│   Collection    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Sync Engine    │ ◄── Queues changes
│  (offline-safe) │
└────────┬────────┘
         │
         ▼ (when online)
┌─────────────────┐
│  Supabase API   │ ◄── Server authoritative
│  (push/pull)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  React Query    │ ◄── Invalidate caches
│  Invalidation   │
└─────────────────┘
```

## Implementation Details

### WatermelonDB Configuration

**Location**: `src/lib/watermelon/`

Key files:

- `database.ts` - Database initialization
- `models/` - Model definitions with decorators
- `schema.ts` - Schema version and migrations

### Sync Engine

**Location**: `src/lib/sync-engine.ts`

Key functions:

- `synchronize()` - Main sync entry point (uses WatermelonDB contract)
- `pullChanges()` - Fetch server changes
- `pushChanges()` - Push local changes
- Conflict resolution: Last-Write-Wins (server authoritative)

### React Query Setup

**Location**: `src/api/common/api-provider.tsx`

Configuration:

- Queries: 5min stale time, 10min garbage collection
- Mutations: Disabled by design (warning in dev mode)
- No persistence layer (no persistQueryClient)

## Examples

### Example 1: Creating a Harvest

```typescript
import { database } from '@/lib/watermelon';

async function createHarvest(data: HarvestInput) {
  // 1. Write to local database
  const harvest = await database.write(async () => {
    const harvestsCollection = database.collections.get('harvests');
    return await harvestsCollection.create((h) => {
      h.plantId = data.plantId;
      h.wetWeightG = data.wetWeight;
      h.stage = 'harvest';
      h.stageStartedAt = new Date();
    });
  });

  // 2. Sync will automatically queue this change
  // No need to manually trigger sync - happens on:
  // - App foreground
  // - Network reconnect
  // - Manual refresh

  return harvest;
}
```

### Example 2: Reading Harvest List

```typescript
import { useQuery } from '@tanstack/react-query';
import { Q } from '@nozbe/watermelondb';

function useHarvests(plantId?: string) {
  return useQuery({
    queryKey: ['harvests', plantId],
    queryFn: async () => {
      const collection = database.collections.get('harvests');
      const query = plantId
        ? collection.query(Q.where('plant_id', plantId))
        : collection.query();

      return await query.fetch();
    },
    staleTime: 5 * 60 * 1000,
  });
}
```

### Example 3: Updating After Sync

```typescript
import { queryClient } from '@/api/common/api-provider';
import { synchronize } from '@/lib/sync-engine';

async function performSync() {
  const result = await synchronize();

  // Invalidate React Query caches after successful sync
  queryClient.invalidateQueries({ queryKey: ['harvests'] });
  queryClient.invalidateQueries({ queryKey: ['inventory'] });

  return result;
}
```

## Migration Guide

### From Direct API Calls

```typescript
// ❌ OLD: Direct API mutation
const { mutate } = useMutation({
  mutationFn: (data) => supabase.from('harvests').insert(data),
});

// ✅ NEW: WatermelonDB write
async function createHarvest(data) {
  await database.write(async () => {
    await harvestsCollection.create((h) => {
      h.wetWeightG = data.wetWeight;
      // ... other fields
    });
  });
}
```

### From Optimistic Updates

```typescript
// ❌ OLD: React Query optimistic update
const { mutate } = useMutation({
  mutationFn: updateHarvest,
  onMutate: async (newData) => {
    await queryClient.cancelQueries(['harvests']);
    const previous = queryClient.getQueryData(['harvests']);
    queryClient.setQueryData(['harvests'], newData);
    return { previous };
  },
});

// ✅ NEW: WatermelonDB update (automatically optimistic)
async function updateHarvest(harvestId: string, updates: Partial<Harvest>) {
  await database.write(async () => {
    const harvest = await harvestsCollection.find(harvestId);
    await harvest.update((h) => {
      Object.assign(h, updates);
    });
  });
  // UI updates immediately via WatermelonDB observers
  // Sync happens in background
}
```

## Troubleshooting

### React Query mutation warning in dev mode

If you see:

```
⚠️ React Query mutation detected. Use WatermelonDB for writes instead.
```

**Solution**: Refactor to use WatermelonDB:

1. Find the mutation code
2. Replace with `database.write()` pattern
3. Remove the mutation hook

### Data not syncing

**Check**:

1. Is sync enabled? (`getSyncStatus()`)
2. Are there pending changes? (`hasPendingLocalChanges()`)
3. Is the device online? (`useNetworkStatus()`)
4. Check sync logs in dev tools

### Stale React Query cache after write

**Solution**: Invalidate queries after sync:

```typescript
queryClient.invalidateQueries({ queryKey: ['harvests'] });
```

## SQLCipher Integration Plan

- **Adapter Evaluation**: Prototype a build using `expo-sqlite` with the OP-SQLCipher fork (or `op-sqlite`) to confirm WatermelonDB compatibility. The spike should wrap SQLCipher in a custom WatermelonDB adapter.
- **Build Requirements**: Ship via a custom development client and production builds—SQLCipher is unavailable in Expo Go. Update EAS profiles to bundle the SQLCipher-enabled SQLite binary.
- **Migration Strategy**: Implement an encrypted-migration path that copies the plain-text database into an encrypted file, with backup and rollback guards. Verify schema bumps and retention workflows post-migration.
- **Key Management**: Persist the encryption key with `expo-secure-store` (Keychain/Keystore). On logout or account deletion, delete the key to render the encrypted DB inaccessible.
- **Testing & Compliance**: Add regression tests targeting the SQLCipher build variant, measure performance impact, and document results in privacy/compliance checklists prior to rollout.

## References

- [WatermelonDB Sync Documentation](https://nozbe.github.io/WatermelonDB/Advanced/Sync.html)
- [React Query v5 Documentation](https://tanstack.com/query/latest)
- [Offline-First Architecture Guide](./sync-engine-guide.md)
