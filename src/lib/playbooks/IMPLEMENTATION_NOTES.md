# Schedule Shifting Implementation Notes

## Overview

Task 6 implements schedule shifting and bulk operations for the Guided Grow Playbooks feature with:

- **Shift Preview**: Shows affected tasks, date ranges, and collision warnings
- **Atomic Operations**: Updates due dates, RRULEs, and notifications together
- **Undo Functionality**: 30-second window with persistent undo ledger
- **Outbox Pattern**: Decouples notification scheduling from database transactions
- **Manual Edit Protection**: Flags tasks to exclude from bulk shifts

## Architecture

### Components Created

1. **UndoDescriptorModel** (`src/lib/watermelon-models/undo-descriptor.ts`)
   - Stores undo state for 30-second window
   - Persists affected task IDs and prior field values
   - Automatically expires after 30 seconds

2. **OutboxNotificationActionModel** (`src/lib/watermelon-models/outbox-notification-action.ts`)
   - Queues notification actions (schedule/cancel)
   - Supports idempotent processing via business_key
   - Includes retry logic with exponential backoff

3. **ScheduleShifter** (`src/lib/playbooks/schedule-shifter.ts`)
   - Generates shift previews
   - Applies shifts atomically
   - Manages undo operations
   - Tracks active shifts in memory

4. **OutboxWorker** (`src/lib/playbooks/outbox-worker.ts`)
   - Processes notification actions asynchronously
   - Implements exponential backoff with jitter
   - Atomic row claiming for concurrent safety
   - TTL/expiry cleanup

### Database Schema

Two new tables added to `watermelon-schema.ts`:

```typescript
// Undo descriptors for 30-second undo window
tableSchema({
  name: 'undo_descriptors',
  columns: [
    { name: 'operation_type', type: 'string' },
    { name: 'affected_task_ids', type: 'string' }, // JSON array
    { name: 'prior_field_values', type: 'string' }, // JSON object
    { name: 'timestamp', type: 'number', isIndexed: true },
    { name: 'expires_at', type: 'number', isIndexed: true },
    { name: 'created_at', type: 'number' },
  ],
});

// Outbox for notification actions
tableSchema({
  name: 'outbox_notification_actions',
  columns: [
    { name: 'action_type', type: 'string' },
    { name: 'payload', type: 'string' }, // JSON object
    { name: 'business_key', type: 'string', isOptional: true, isIndexed: true },
    { name: 'ttl', type: 'number' },
    { name: 'expires_at', type: 'number', isIndexed: true },
    { name: 'next_attempt_at', type: 'number', isIndexed: true },
    { name: 'attempted_count', type: 'number' },
    { name: 'status', type: 'string', isIndexed: true },
    { name: 'last_error', type: 'string', isOptional: true },
    { name: 'created_at', type: 'number' },
    { name: 'updated_at', type: 'number' },
  ],
});
```

## Outbox Pattern

The outbox pattern is critical for maintaining atomicity between database updates and notification scheduling:

### Why Outbox?

OS notification APIs are not transactional. If we schedule notifications inside a database transaction:

- The notification might succeed but the transaction rolls back
- The transaction might succeed but the notification fails
- This creates state drift between DB and OS

### How It Works

1. **Write Phase**: Within a DB transaction, we:
   - Update task dates/RRULEs
   - Write notification actions to outbox table
   - Create undo descriptor
   - All atomic - either all succeed or all fail

2. **Process Phase**: Separate worker:
   - Reads pending outbox rows
   - Atomically claims rows for processing
   - Performs OS notification operations
   - Marks rows as completed/failed
   - Retries with exponential backoff

3. **Cleanup Phase**:
   - Expired actions marked as expired
   - Completed/expired actions deleted after 24 hours
   - Prevents unbounded growth

### Idempotency

- `business_key` field ensures deduplication
- Worker checks business_key before processing
- Safe to run multiple workers concurrently
- Crash-safe: unclaimed rows picked up on restart

## Usage Example

```typescript
import { PlaybookService } from '@/lib/playbooks';
import { OutboxWorker } from '@/lib/playbooks';

// Initialize service
const service = new PlaybookService({
  database,
  analytics,
});

// Start outbox worker
const worker = new OutboxWorker({
  database,
  notificationScheduler,
});
worker.start(5000); // Process every 5 seconds

// Generate preview
const preview = await service.shiftPlaybookSchedule(
  plantId,
  3, // Shift 3 days forward
  {
    includeCompleted: false,
    includeManuallyEdited: false,
  }
);

// Apply shift
await service.confirmScheduleShift(plantId, preview.shiftId);

// Undo within 30 seconds
await service.undoScheduleShift(plantId, preview.shiftId);

// Stop worker on app shutdown
worker.stop();
```

## Analytics Events

Three new analytics events added to `src/lib/analytics.ts`:

```typescript
shift_preview: {
  plantId: string;
  daysDelta: number;
  affectedTaskCount: number;
  manuallyEditedCount: number;
}

shift_apply: {
  plantId: string;
  shiftId: string;
  daysDelta: number;
  affectedTaskCount: number;
  durationMs: number;
}

shift_undo: {
  plantId: string;
  shiftId: string;
  affectedTaskCount: number;
}
```

## Manual Edit Protection

Tasks with `metadata.flags.manualEdited = true` are excluded from bulk shifts by default:

```typescript
// Mark task as manually edited
await task.update((record) => {
  const metadata = record.metadata as any;
  metadata.flags = metadata.flags || {};
  metadata.flags.manualEdited = true;
  record.metadata = metadata;
});

// Shift will skip this task unless includeManuallyEdited: true
```

## Testing Considerations

### Unit Tests Needed

1. **ScheduleShifter**:
   - Preview generation with various filters
   - Atomic shift application
   - Undo within window
   - Undo expiry after 30 seconds
   - Manual edit protection

2. **OutboxWorker**:
   - Action processing
   - Retry logic with exponential backoff
   - Concurrent worker safety
   - Crash recovery
   - TTL cleanup

3. **Integration**:
   - End-to-end shift workflow
   - Notification rescheduling
   - Undo restoration
   - Conflict handling

### Test Scenarios

```typescript
describe('Schedule Shifting', () => {
  test('shifts future tasks only by default', async () => {
    // Create tasks: 2 future, 1 completed, 1 past
    // Shift +3 days
    // Verify only 2 future tasks shifted
  });

  test('excludes manually edited tasks', async () => {
    // Create 3 tasks, mark 1 as manually edited
    // Shift +3 days
    // Verify 2 tasks shifted, 1 excluded
  });

  test('undo restores original state', async () => {
    // Shift tasks
    // Capture original dates
    // Undo
    // Verify dates restored
  });

  test('undo expires after 30 seconds', async () => {
    // Shift tasks
    // Wait 31 seconds
    // Attempt undo
    // Verify error thrown
  });
});

describe('OutboxWorker', () => {
  test('processes pending actions', async () => {
    // Create outbox actions
    // Run worker
    // Verify actions processed
  });

  test('retries failed actions with backoff', async () => {
    // Create action that fails
    // Run worker multiple times
    // Verify exponential backoff
  });

  test('cleans up expired actions', async () => {
    // Create expired actions
    // Run worker
    // Verify actions marked expired
  });
});
```

## Known Limitations

1. **Method Length**: Some methods in `ScheduleShifter` exceed 70 lines (ESLint rule)
   - `generatePreview`: 124 lines
   - `applyShift`: 153 lines
   - `undoShift`: 99 lines
   - **TODO**: Refactor into smaller helper methods

2. **Type Safety**: Analytics events use string literals
   - TypeScript should catch typos but runtime validation would be better
   - Consider adding runtime schema validation

3. **Concurrency**: Multiple shifts on same plant
   - Currently no locking mechanism
   - Last write wins
   - Consider adding optimistic locking

## Future Enhancements

1. **Batch Operations**: Shift multiple plants at once
2. **Conditional Shifts**: Shift only specific phases
3. **Smart Scheduling**: AI-suggested optimal shift amounts
4. **Conflict Resolution**: Better handling of overlapping tasks
5. **Audit Trail**: Full history of all shifts and undos

## Performance Considerations

- Shift preview is read-only, no DB writes
- Shift application uses single transaction
- Outbox worker processes in batches of 10
- Cleanup runs automatically with worker
- Memory usage: O(n) where n = affected tasks

## Security Considerations

- No PII in analytics events
- Plant IDs are UUIDs (non-sequential)
- Undo descriptors auto-expire
- Outbox actions have TTL
- No user-provided SQL

## Compliance

- GDPR: No personal data in analytics
- Data retention: Undo descriptors expire in 30s
- Right to deletion: Cascade deletes work
- Audit trail: All operations logged
