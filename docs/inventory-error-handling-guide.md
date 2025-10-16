# Inventory Error Handling Guide

Comprehensive guide for error handling in the inventory system with Sentry integration, recovery patterns, and undo functionality.

## Overview

The inventory system implements a multi-layered error handling strategy:

1. **Error Categorization**: Domain-specific error types with structured data
2. **Sentry Integration**: Conservative breadcrumb logging and privacy-focused reporting
3. **Recovery Options**: Actionable recovery paths for all error scenarios
4. **Undo Functionality**: 15-second undo window for destructive actions
5. **Error Boundaries**: Component-level error containment with fallback UI

## Error Categories

### Inventory-Specific Categories

```typescript
type ErrorCategory =
  | 'network' // Network/connectivity errors (retryable)
  | 'permission' // Authorization failures (not retryable)
  | 'validation' // Input validation errors (not retryable)
  | 'insufficient_stock' // Insufficient inventory (recoverable)
  | 'batch_expired' // Expired batch access (override required)
  | 'duplicate_lot' // Duplicate lot number (not retryable)
  | 'conflict' // Sync conflict (LWW resolution)
  | 'rate_limit' // Rate limiting (retryable with backoff)
  | 'unknown'; // Unknown errors
```

### Error Types

#### Validation Errors

Field-level validation failures with specific error messages.

```typescript
interface InventoryValidationError {
  code: 'VALIDATION_ERROR';
  field: string;
  message: string;
  value: unknown;
}

// Example
{
  code: 'VALIDATION_ERROR',
  field: 'quantity',
  message: 'Quantity must be a positive number',
  value: -5
}
```

#### Business Logic Errors

Domain-specific errors with context and recovery options.

```typescript
interface InventoryBusinessError {
  code: 'BUSINESS_ERROR';
  type: 'INSUFFICIENT_STOCK' | 'BATCH_EXPIRED' | 'DUPLICATE_LOT' | ...;
  message: string;
  context: Record<string, unknown>;
  recoveryOptions: RecoveryOption[];
}
```

#### Sync Errors

Synchronization failures with conflict resolution.

```typescript
interface InventorySyncError {
  code: 'SYNC_ERROR';
  type: 'NETWORK_ERROR' | 'CONFLICT' | 'SERVER_ERROR';
  message: string;
  retryable: boolean;
  conflictData?: {
    localVersion: unknown;
    remoteVersion: unknown;
    conflictMessage: string;
    reapplyAction?: () => Promise<void>;
  };
}
```

## Recovery Patterns

### Insufficient Stock Recovery

Three recovery options for insufficient inventory:

#### 1. Partial Complete

Consume available stock and log shortage:

```typescript
import { handlePartialComplete } from '@/lib/inventory/insufficient-stock-handler';

await handlePartialComplete({
  database,
  error: insufficientStockError,
  taskId: 'task-123',
  idempotencyKey: 'deduction:task-123:hash',
});

// Creates movements for available quantity
// Reason: "Partial deduction: consumed 25ml, shortage 25ml"
```

#### 2. Skip Deduction

Complete task without updating inventory:

```typescript
import { handleSkipDeduction } from '@/lib/inventory/insufficient-stock-handler';

await handleSkipDeduction({
  database,
  error: insufficientStockError,
  taskId: 'task-123',
  idempotencyKey: 'deduction:task-123:hash',
});

// Creates zero-quantity marker movement
// Reason: "Skipped deduction due to insufficient stock"
```

#### 3. Adjust Inventory

Navigate user to add stock, then retry:

```typescript
import { prepareAdjustmentData } from '@/lib/inventory/insufficient-stock-handler';

const adjustData = prepareAdjustmentData(insufficientStockError);
// Show UI for adding new batch with required quantity
// After successful addition, retry deduction automatically
```

### Batch Expiration Override

For expired batches, require explicit override with reason:

```typescript
import { pickBatchesForConsumption } from '@/lib/inventory/batch-picker';
import { logBatchExpirationOverride } from '@/lib/inventory/sentry-breadcrumbs';

const result = await pickBatchesForConsumption({
  database,
  itemId,
  quantityNeeded: 100,
  allowExpiredOverride: true, // User confirmed override
});

// Log override for audit trail
logBatchExpirationOverride({
  batchId: batch.id,
  lotNumber: batch.lotNumber,
  expiresOn: batch.expiresOn,
  reason: 'Emergency use approved by supervisor',
});
```

### Sync Conflict Resolution

Last-Write-Wins with "Reapply my change" action:

```typescript
import { logSyncConflict, logConflictResolution } from '@/lib/inventory/sentry-breadcrumbs';

// Detect conflict
logSyncConflict({
  table: 'inventory_items',
  recordId: item.id,
  localUpdatedAt: localItem.updatedAt,
  remoteUpdatedAt: remoteItem.updatedAt,
});

// Show conflict toast
showMessage({
  message: 'Last write wins; your change overwritten by device X at <timestamp>',
  type: 'warning',
  duration: 15000,
  renderFlashMessageIcon: () => (
    <Button
      label="Reapply my change"
      onPress={async () => {
        // Create new server write with local data
        await reapplyLocalChange(localItem);
        logConflictResolution({
          table: 'inventory_items',
          recordId: item.id,
          action: 'REAPPLY_LOCAL',
        });
      }}
    />
  ),
});
```

## Undo Functionality

### 15-Second Undo Window

Destructive actions can be undone within 15 seconds:

```typescript
import {
  createBatchDeleteUndo,
  createAdjustmentUndo,
} from '@/lib/inventory/undo-service';
import { showUndoToast } from '@/components/inventory/undo-toast';

// After deleting a batch
const undoInfo = createBatchDeleteUndo(database, batchId, {
  itemId: batch.itemId,
  lotNumber: batch.lotNumber,
  expiresOn: batch.expiresOn,
  quantity: batch.quantity,
  costPerUnitMinor: batch.costPerUnitMinor,
  receivedAt: batch.receivedAt,
});

// Show undo toast
showUndoToast({
  undoInfo,
  onUndoSuccess: () => {
    console.log('Batch deletion undone');
  },
  onUndoFail: (error) => {
    console.error('Undo failed:', error);
  },
});
```

### Supported Undo Actions

- **DELETE_BATCH**: Restore deleted batch with all original data
- **ADJUST_INVENTORY**: Reverse inventory adjustment movement
- **DELETE_ITEM**: Restore deleted item (only if no dependent batches/movements)

### Implementation Example

```typescript
// Batch deletion with undo
async function deleteBatch(batchId: string) {
  const batch = await database
    .get<InventoryBatchModel>('inventory_batches')
    .find(batchId);

  // Capture original data
  const originalData = {
    itemId: batch.itemId,
    lotNumber: batch.lotNumber,
    expiresOn: batch.expiresOn,
    quantity: batch.quantity,
    costPerUnitMinor: batch.costPerUnitMinor,
    receivedAt: batch.receivedAt,
  };

  // Soft delete
  await database.write(async () => {
    await batch.update((b: any) => {
      b.deletedAt = new Date();
    });
  });

  // Register undo
  const undoInfo = createBatchDeleteUndo(database, batchId, originalData);

  // Show undo toast
  showUndoToast({ undoInfo });
}
```

## Sentry Integration

### Conservative Breadcrumb Strategy

Only log actionable events to avoid performance overhead:

```typescript
import {
  logInventoryItemOperation,
  logBatchOperation,
  logInventoryMovement,
  logDeductionAttempt,
  logInsufficientStock,
} from '@/lib/inventory/sentry-breadcrumbs';

// Item operations
logInventoryItemOperation({
  operation: 'create',
  itemId: item.id,
  itemName: item.name,
  category: item.category,
});

// Batch operations
logBatchOperation({
  operation: 'create',
  batchId: batch.id,
  itemId: batch.itemId,
  lotNumber: batch.lotNumber,
  quantity: batch.quantity,
});

// Movements
logInventoryMovement({
  type: 'consumption',
  itemId: item.id,
  quantityDelta: -50,
  taskId: 'task-123',
});

// Deduction attempts
logDeductionAttempt({
  itemId: item.id,
  itemName: item.name,
  requestedQuantity: 100,
  availableQuantity: 75,
  taskId: 'task-123',
});

// Insufficient stock
logInsufficientStock({
  itemId: item.id,
  itemName: item.name,
  required: 100,
  available: 75,
  taskId: 'task-123',
});
```

### Breadcrumb Categories

- `inventory.item`: Item create/update/delete
- `inventory.batch`: Batch operations
- `inventory.movement`: Movement creation
- `inventory.deduction`: Deduction attempts
- `inventory.insufficient_stock`: Insufficient stock errors
- `inventory.recovery`: Recovery action selections
- `inventory.csv`: CSV import operations
- `inventory.undo`: Undo actions
- `sync.inventory`: Sync operations
- `sync.conflict`: Conflict detection and resolution

### Error Reporting

Use categorized error capture for better filtering:

```typescript
import { captureCategorizedErrorSync } from '@/lib/sentry-utils';

try {
  await deduceInventory(database, request);
} catch (error) {
  captureCategorizedErrorSync(error, {
    feature: 'inventory',
    operation: 'deduction',
    taskId: request.taskId,
    itemIds: request.deductionMap.map((e) => e.itemId),
  });
  throw error;
}
```

## Error Boundaries

### Component-Level Protection

Wrap inventory screens with error boundaries:

```typescript
import { InventoryErrorBoundary } from '@/components/inventory/inventory-error-boundary';

export default function InventoryScreen() {
  return (
    <InventoryErrorBoundary
      context={{ screen: 'inventory-list' }}
    >
      <InventoryList />
    </InventoryErrorBoundary>
  );
}
```

### Custom Fallback UI

Provide custom fallback for specific screens:

```typescript
<InventoryErrorBoundary
  fallback={({ error, resetErrorBoundary }) => (
    <CustomErrorFallback
      error={error}
      onRetry={resetErrorBoundary}
      onNavigateBack={() => router.back()}
    />
  )}
  context={{ screen: 'batch-details' }}
>
  <BatchDetailsScreen />
</InventoryErrorBoundary>
```

## Field-Level Validation

### Form Validation with Error Mapping

Map server validation errors to form fields:

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

function AddInventoryItemScreen() {
  const [serverValidationErrors, setServerValidationErrors] = useState<Record<string, string>>({});

  const { control, handleSubmit, clearErrors } = useForm({
    resolver: zodResolver(addItemSchema),
  });

  const onSubmit = async (data: FormData) => {
    try {
      const result = await createInventoryItem(data);

      if (!result.success) {
        if (result.validationErrors) {
          // Map to form fields
          const fieldErrors: Record<string, string> = {};
          result.validationErrors.forEach((error) => {
            fieldErrors[error.field] = error.message;
          });
          setServerValidationErrors(fieldErrors);
        }
      }
    } catch (error) {
      // Handle unexpected errors
    }
  };

  return (
    <Form>
      <Input
        name="quantity"
        control={control}
        error={errors.quantity?.message || serverValidationErrors.quantity}
      />
    </Form>
  );
}
```

## Testing Error Handling

### Unit Tests

```typescript
import { categorizeError } from '@/lib/error-handling';

describe('Error Categorization', () => {
  it('should categorize insufficient stock errors', () => {
    const error = {
      code: 'INSUFFICIENT_STOCK',
      message: 'Insufficient stock available',
    };

    const category = categorizeError(error);

    expect(category.category).toBe('insufficient_stock');
    expect(category.isRetryable).toBe(false);
  });
});
```

### Integration Tests

```typescript
import { deduceInventory } from '@/lib/inventory/deduction-service';

describe('Insufficient Stock Handling', () => {
  it('should provide recovery options', async () => {
    const result = await deduceInventory(database, {
      deductionMap: [{ itemId, unit: 'ml', perTaskQuantity: 100 }],
    });

    expect(result.success).toBe(false);
    expect(result.insufficientItems).toHaveLength(1);
    expect(result.insufficientItems[0].recoveryOptions).toHaveLength(3);
  });
});
```

## Best Practices

1. **Always provide recovery options**: Every error should have at least one actionable recovery path
2. **Log conservatively**: Only log actionable events to Sentry (avoid per-frame breadcrumbs)
3. **Respect privacy**: Use `captureCategorizedErrorSync` to respect user consent and scrub PII
4. **Show undo toasts**: For destructive actions, always show undo toast within 15-second window
5. **Map validation errors**: Always map server validation errors to specific form fields
6. **Use error boundaries**: Wrap all inventory screens with `InventoryErrorBoundary`
7. **Test error scenarios**: Write tests for all error paths and recovery options
8. **Monitor error rates**: Track insufficient stock, deduction failures, and sync conflicts

## Monitoring and Alerts

### Key Metrics to Track

- Insufficient stock error rate
- Auto-deduction failure rate
- Sync conflict count
- Undo action success rate
- Import error rate
- Recovery action distribution (partial/skip/adjust)

### Sentry Dashboard Queries

```javascript
// Insufficient stock errors
event.tags[category]:"insufficient_stock" AND event.tags[feature]:"inventory"

// Deduction failures
event.breadcrumbs[category]:"inventory.deduction" AND event.level:warning

// Sync conflicts
event.breadcrumbs[category]:"sync.conflict"

// Failed undo actions
event.breadcrumbs[category]:"inventory.undo" AND event.breadcrumbs[data.success]:false
```

## Troubleshooting

### Common Issues

#### Undo Not Working

- **Issue**: Undo action fails after 15 seconds
- **Solution**: Undo window has expired. Implement manual reversal via adjustment movements.

#### Breadcrumbs Not Appearing

- **Issue**: Breadcrumbs not showing in Sentry
- **Solution**: Verify user has consented to crash reporting. Check `beforeSendHook` in sentry-utils.ts.

#### Validation Errors Not Showing

- **Issue**: Server validation errors not mapping to form fields
- **Solution**: Ensure server returns `validationErrors` array with `field` property matching form field names.

#### Error Boundary Not Catching Errors

- **Issue**: Errors bypass error boundary
- **Solution**: Ensure error is thrown during render, not in event handlers. Use `useErrorHandler` hook for async errors.
