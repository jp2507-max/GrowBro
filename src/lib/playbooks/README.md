# Playbook Service

The Playbook Service manages playbook selection, application, and template management for the Guided Grow Playbooks feature.

## Features

- **Playbook Preview**: Generate previews showing total weeks, phase durations, and task counts
- **Constraint Enforcement**: One-active-playbook-per-plant constraint (configurable)
- **Idempotent Application**: Prevent duplicate playbook applications using idempotency keys
- **Performance Tracking**: Track application duration and emit analytics events
- **Guided Plant Creation**: Support for creating plants when applying playbooks

## Usage

```typescript
import { PlaybookService } from '@/lib/playbooks';
import { database } from '@/lib/watermelon';
import { analytics } from '@/lib/analytics';

// Initialize service
const playbookService = new PlaybookService({
  database,
  analytics,
});

// Get available playbooks
const playbooks = await playbookService.getAvailablePlaybooks();

// Get playbook preview
const preview = await playbookService.getPlaybookPreview('playbook-id');
console.log(preview.totalWeeks); // Total weeks
console.log(preview.totalTasks); // Total task count
console.log(preview.phaseBreakdown); // Per-phase breakdown

// Apply playbook to plant
const result = await playbookService.applyPlaybookToPlant(
  'playbook-id',
  'plant-id',
  {
    idempotencyKey: 'unique-key', // Optional: prevent duplicate applications
    allowMultiple: false, // Optional: allow multiple playbooks per plant
  }
);

console.log(result.appliedTaskCount); // Number of tasks created
console.log(result.durationMs); // Application duration
console.log(result.jobId); // Unique job identifier
```

## API Reference

### `getAvailablePlaybooks(): Promise<Playbook[]>`

Returns all available (non-deleted) playbooks.

### `getPlaybookPreview(playbookId: string): Promise<PlaybookPreview>`

Generates a preview of a playbook showing:

- Total weeks
- Total task count
- Per-phase breakdown (duration and task count)

### `validateOneActivePlaybookPerPlant(plantId: string, playbookId: string): Promise<boolean>`

Validates the one-active-playbook-per-plant constraint. Returns `true` if:

- No playbook is currently applied to the plant
- The same playbook is already applied (re-application allowed)

Returns `false` if a different playbook is already applied.

### `applyPlaybookToPlant(playbookId: string, plantId: string, options?: ApplyPlaybookOptions): Promise<PlaybookApplicationResult>`

Applies a playbook to a plant with the following features:

- **Idempotency**: Use `idempotencyKey` to prevent duplicate applications
- **Constraint Checking**: Enforces one-active-playbook-per-plant unless `allowMultiple` is true
- **Performance Tracking**: Records application duration
- **Analytics**: Emits `playbook_apply` event

**Options:**

- `idempotencyKey?: string` - Unique key to prevent duplicate applications
- `allowMultiple?: boolean` - Allow multiple playbooks per plant (default: false)

**Returns:**

- `appliedTaskCount: number` - Number of tasks created (currently 0, will be implemented in task 5)
- `durationMs: number` - Application duration in milliseconds
- `jobId: string` - Unique job identifier
- `playbookId: string` - Applied playbook ID
- `plantId: string` - Target plant ID

**Throws:**

- Error if plant already has a different active playbook (unless `allowMultiple` is true)

## Placeholder Methods

The following methods are placeholders for future tasks:

- `shiftPlaybookSchedule()` - Task 6: Schedule shifting
- `confirmScheduleShift()` - Task 6: Confirm schedule shift
- `undoScheduleShift()` - Task 6: Undo schedule shift
- `suggestScheduleAdjustments()` - Task 9: AI-driven adjustments
- `applyAISuggestion()` - Task 9: Apply AI suggestions

## Analytics Events

The service emits the following analytics events:

### `playbook_apply`

Emitted when a playbook is successfully applied to a plant.

**Payload:**

```typescript
{
  playbookId: string;
  setupType?: string; // e.g., 'auto_indoor'
  strainType?: string; // Comma-separated strain types
}
```

## Database Models

### PlaybookApplicationModel

Tracks playbook applications with the following fields:

- `playbookId` - ID of the applied playbook
- `plantId` - ID of the target plant
- `appliedAt` - Application timestamp
- `taskCount` - Number of tasks created
- `durationMs` - Application duration
- `jobId` - Unique job identifier
- `idempotencyKey` - Idempotency key (optional)
- `status` - Application status: 'pending' | 'completed' | 'failed'

## Testing

Run tests with:

```bash
pnpm test playbook-service
```

The test suite covers:

- Playbook retrieval
- Preview generation
- Constraint validation
- Idempotent application
- Performance tracking
- Analytics events
- Error handling

## Task Generator

The Task Generator converts playbook templates into concrete calendar tasks with timezone-aware scheduling and notification management.

### Features

- **RRULE Pattern Assignment**: RFC 5545 compliant recurrence patterns
- **Timezone-Aware Calculations**: Proper DST handling using Luxon
- **Traceability**: Immutable `origin_step_id` for tracking task origins
- **Performance Optimization**: `phase_index` for faster progress queries
- **Batched Operations**: Efficient database inserts and notification scheduling
- **Category-Specific Reminders**: Default reminder times per task type

### Usage

```typescript
import { TaskGenerator } from '@/lib/playbooks';
import { database } from '@/lib/watermelon';

const taskGenerator = new TaskGenerator({ database });

// Generate tasks from playbook
const result = await taskGenerator.generateTasksFromPlaybook(playbook, plant);

console.log(result.generatedTaskCount); // Number of tasks created
console.log(result.taskIds); // Array of created task IDs
console.log(result.durationMs); // Generation duration
```

### Default Reminder Times

| Task Type | Default Time |
| --------- | ------------ |
| water     | 08:00        |
| feed      | 08:00        |
| prune     | 10:00        |
| train     | 10:00        |
| monitor   | 20:00        |
| note      | 09:00        |
| custom    | 09:00        |

### Phase Index Mapping

| Phase    | Index |
| -------- | ----- |
| seedling | 0     |
| veg      | 1     |
| flower   | 2     |
| harvest  | 3     |

## Implementation Status

✅ **Completed (Tasks 4-5):**

- Playbook selection and preview
- One-active-playbook-per-plant constraint
- Idempotent application
- Performance tracking
- Analytics events
- Task generation from playbook templates
- RRULE pattern assignment
- Timezone-aware date calculations
- Batched notification scheduling

⏳ **Pending:**

- Schedule shifting (Task 6)
- AI-driven adjustments (Task 9)

## Related Files

- `src/lib/playbooks/playbook-service.ts` - Service implementation
- `src/lib/playbooks/playbook-service.test.ts` - Service test suite
- `src/lib/playbooks/task-generator.ts` - Task generator implementation
- `src/lib/playbooks/task-generator.test.ts` - Task generator test suite
- `src/lib/playbooks/index.ts` - Module exports
- `src/types/playbook.ts` - Type definitions
- `src/lib/watermelon-models/playbook.ts` - Playbook model
- `src/lib/watermelon-models/playbook-application.ts` - Application tracking model
- `src/lib/watermelon-models/task.ts` - Task model
- `src/lib/rrule/generator.ts` - RRULE generation and validation
- `src/lib/notifications/playbook-notification-scheduler.ts` - Notification scheduling

## Schedule Shifting (Task 6)

The Schedule Shifter handles bulk schedule operations with atomic updates and undo support.

### Features

- **Shift Preview**: Shows affected tasks, date ranges, and collision warnings
- **Atomic Operations**: Updates due dates, RRULEs, and notifications together
- **Undo Functionality**: 30-second window with persistent undo ledger
- **Outbox Pattern**: Decouples notification scheduling from database transactions
- **Manual Edit Protection**: Flags tasks to exclude from bulk shifts

### Usage

```typescript
import { ScheduleShifter } from '@/lib/playbooks';

const shifter = new ScheduleShifter({
  database,
  analytics,
});

// Generate preview
const preview = await shifter.generatePreview(
  plantId,
  3, // Shift 3 days forward
  {
    includeCompleted: false,
    includeManuallyEdited: false,
  }
);

console.log(preview.affectedTaskCount); // Number of tasks to shift
console.log(preview.manuallyEditedCount); // Excluded tasks
console.log(preview.collisionWarnings); // Warnings

// Apply shift
await shifter.applyShift(preview.shiftId);

// Undo within 30 seconds
await shifter.undoShift(plantId, preview.shiftId);
```

### Outbox Worker

The Outbox Worker processes notification actions asynchronously to maintain atomicity:

```typescript
import { OutboxWorker } from '@/lib/playbooks';

const worker = new OutboxWorker({
  database,
  notificationScheduler,
  maxRetries: 5,
  baseDelayMs: 1000,
  maxDelayMs: 60000,
});

// Start processing every 5 seconds
worker.start(5000);

// Stop on app shutdown
worker.stop();
```

### Analytics Events

**shift_preview**

```typescript
{
  plantId: string;
  daysDelta: number;
  affectedTaskCount: number;
  manuallyEditedCount: number;
}
```

**shift_apply**

```typescript
{
  plantId: string;
  shiftId: string;
  daysDelta: number;
  affectedTaskCount: number;
  durationMs: number;
}
```

**shift_undo**

```typescript
{
  plantId: string;
  shiftId: string;
  affectedTaskCount: number;
}
```

### Database Models

**UndoDescriptorModel**

- `operationType` - Type of operation ('schedule_shift')
- `affectedTaskIds` - Array of affected task IDs
- `priorFieldValues` - JSON object with prior state
- `timestamp` - Operation timestamp
- `expiresAt` - Expiry timestamp (30 seconds after creation)

**OutboxNotificationActionModel**

- `actionType` - 'schedule' | 'cancel'
- `payload` - JSON object with notification data
- `businessKey` - Optional deduplication key
- `ttl` - Time to live in milliseconds
- `expiresAt` - Expiry timestamp
- `nextAttemptAt` - Next retry timestamp
- `attemptedCount` - Number of attempts
- `status` - 'pending' | 'processing' | 'completed' | 'expired' | 'failed'
- `lastError` - Last error message

### Architecture

See [IMPLEMENTATION_NOTES.md](./IMPLEMENTATION_NOTES.md) for detailed architecture documentation including:

- Outbox pattern rationale
- Idempotency guarantees
- Retry logic
- Cleanup strategies
- Testing considerations
