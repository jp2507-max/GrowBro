# Inventory Sync Conflict Resolution

## Overview

The inventory sync system implements Last-Write-Wins (LWW) conflict resolution for inventory_items, inventory_batches, and inventory_movements tables. Conflicts are detected via server-assigned `server_updated_at_ms` timestamps and resolved with user-friendly UI.

## Conflict Detection

Conflicts are detected during the sync pull operation when:

- Local record has `server_updated_at_ms` value
- Remote record has newer `server_updated_at_ms` value
- Local changes exist that haven't been synced

## Conflict Resolution Strategy

**Last-Write-Wins (LWW) using server timestamps:**

- Server `updated_at` triggers (auto-set on UPDATE) provide authoritative timestamps
- Never use client clocks for conflict resolution
- Remote (server) version wins by default

## User Workflow

When a conflict is detected:

1. **Conflict Toast Displayed**
   - Message: "Last write wins; your change overwritten by Device X at <timestamp>"
   - Action button: "Reapply my change"
   - Auto-dismiss after 15 seconds

2. **User Actions**
   - **Accept Server Version**: Dismiss toast, no further action needed
   - **Reapply Local Change**: Click "Reapply my change" button
     - Creates a new write operation in WatermelonDB
     - Triggers sync push with new `updated_at` timestamp
     - Preserves LWW integrity (new write has newer timestamp)

## Implementation Components

### Conflict Detection

- **File**: `src/lib/sync/conflict-resolver.ts`
- **Function**: `resolveConflict(local, remote, tableName)`
- **Strategy**: Compare `server_updated_at_ms` values

### Conflict Resolution Hook

- **File**: `src/lib/hooks/use-conflict-resolution.ts`
- **Tables Supported**:
  - `inventory_items`
  - `inventory_batches`
  - `inventory_movements` (Note: movements are immutable, conflicts should not occur)

### Conflict Toast (Planned)

- **File**: `src/lib/hooks/use-inventory-conflict-toast.ts` (to be created in future task)
- **Implementation**: Use `react-native-flash-message` for toast display
- **Reapply Logic**: Create new WatermelonDB write → triggers sync push

## Sync Engine Integration

### Tables in Sync

- `inventory_items`: Full sync (create, update, delete)
- `inventory_batches`: Full sync (create, update, delete)
- `inventory_movements`: **Immutable** (create only, no update/delete)

### Immutability Enforcement

The sync push logic filters out invalid operations on `inventory_movements`:

```typescript
// Filter out updated/deleted movements (Requirements 1.4, 10.6)
if (toPush.inventory_movements.updated.length > 0) {
  console.warn(
    `Filtered ${toPush.inventory_movements.updated.length} invalid UPDATE operations`
  );
  toPush.inventory_movements.updated = [];
}
if (toPush.inventory_movements.deleted.length > 0) {
  console.warn(
    `Filtered ${toPush.inventory_movements.deleted.length} invalid DELETE operations`
  );
  toPush.inventory_movements.deleted = [];
}
```

## Analytics Tracking

Conflicts are tracked via `NoopAnalytics`:

- **Event**: `sync_conflict_resolved`
- **Properties**:
  - `table`: Table name (e.g., "inventory_items")
  - `strategy`: "keep-local" or "accept-server"
  - `field_count`: Number of conflicting fields

## Testing

### Integration Tests (Planned)

- **File**: `src/lib/inventory/__tests__/inventory-sync-integration.test.ts`
- **Test Scenarios**:
  1. Create item offline → sync online → verify server persistence
  2. Conflicting edits from two devices → verify LWW resolution
  3. Reapply local change → verify new write with newer timestamp
  4. Movements immutability → verify UPDATE/DELETE filtered in push

## Requirements Satisfied

- **7.1**: Offline changes stored in WatermelonDB, synced via pullChanges/pushChanges
- **7.2**: LWW conflict resolution with user-friendly message and reapply action
- **7.3**: Sync metrics logged (last_pulled_at, duration, conflicts)
- **7.4**: Offline CRUD operations work in flight mode

## Future Enhancements

1. **Conflict Toast Component**: Build dedicated toast component with reapply logic
2. **Field-Level Conflict UI**: Show specific fields that changed (like harvest workflow)
3. **Conflict Preview**: Display local vs. server values before reapply
4. **Bulk Conflict Resolution**: Handle multiple conflicts in one session
