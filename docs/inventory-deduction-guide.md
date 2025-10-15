# Inventory Deduction System Guide

## Overview

The Inventory Deduction System automatically reduces inventory levels when tasks are completed. It integrates with the task completion workflow to track consumption of nutrients, seeds, containers, and other consumables.

## Features

- **Automatic Deduction**: Inventory is automatically deducted when tasks complete
- **FEFO Picking**: Batches expiring soonest are consumed first (First-Expire-First-Out)
- **FIFO Costing**: Cost tracking uses First-In-First-Out for accurate accounting
- **Idempotency**: Duplicate task submissions don't create duplicate deductions
- **Atomic Transactions**: All or nothing - partial failures roll back completely
- **Three-Choice Recovery**: Handle insufficient stock with partial/skip/adjust options

## How It Works

### 1. Task Template Configuration

Add a `deductionMap` to task metadata or series configuration:

```json
{
  "metadata": {
    "deductionMap": [
      {
        "itemId": "uuid-of-inventory-item",
        "unit": "ml",
        "perTaskQuantity": 100,
        "scalingMode": "fixed",
        "label": "Nutrient A dose"
      },
      {
        "itemId": "uuid-of-another-item",
        "unit": "ml",
        "perPlantQuantity": 50,
        "scalingMode": "per-plant",
        "label": "Nutrient B per plant"
      }
    ]
  }
}
```

### 2. Deduction Map Entry Fields

- **itemId** (required): UUID of the inventory item to deduct from
- **unit** (required): Unit of measure (must match item's unit)
- **perTaskQuantity** (optional): Fixed quantity per task
- **perPlantQuantity** (optional): Quantity per plant (requires plantCount in context)
- **scalingMode** (optional): `'fixed'`, `'per-plant'`, or `'ec-based'` (default: `'fixed'`)
- **label** (optional): Human-readable description for movement reason

### 3. Scaling Modes

#### Fixed

Use a fixed quantity per task completion:

```json
{
  "itemId": "...",
  "unit": "ml",
  "perTaskQuantity": 100,
  "scalingMode": "fixed"
}
```

#### Per-Plant

Multiply quantity by number of plants:

```json
{
  "itemId": "...",
  "unit": "ml",
  "perPlantQuantity": 50,
  "scalingMode": "per-plant"
}
```

Result: `50ml × 3 plants = 150ml consumed`

#### EC-Based (Advanced)

Calculate nutrient amount based on target EC/PPM:

```json
{
  "itemId": "...",
  "unit": "ml",
  "perTaskQuantity": 10,
  "scalingMode": "ec-based"
}
```

Requires context with `targetEc`, `targetPpm`, or `ppmScale` + `reservoirVolume`.

## Batch Picking (FEFO)

Batches are consumed in **First-Expire-First-Out** order:

1. Sort by `expires_on` (earliest first)
2. Exclude expired batches by default
3. Fall back to `received_at` for tie-breaking

### Example

```
Batch A: 100ml, expires 2025-11-01
Batch B: 100ml, expires 2025-12-01
Batch C: 100ml, no expiration

Deduct 150ml → Consumes all of Batch A (100ml) + 50ml from Batch B
```

### Expired Batch Override

Expired batches are excluded from automatic picking but can be manually selected:

```typescript
await deduceInventory(database, {
  source: 'manual',
  deductionMap: [...],
  allowExpiredOverride: true,
  expiredOverrideReason: 'User acknowledged expiration date',
});
```

## Cost Tracking (FIFO)

Costs are tracked using **First-In-First-Out** accounting:

- Each batch has a `cost_per_unit_minor` (in cents)
- Movements copy the cost from the source batch at time of consumption
- Historical costs never change (no revaluation)

### Example

```
Batch 1: 100ml @ $0.50/ml (received Oct 1)
Batch 2: 100ml @ $0.60/ml (received Oct 15)

Consume 150ml (FEFO picking by expiration):
- Movement 1: 100ml @ $0.50 from Batch 1 = $50.00 total
- Movement 2: 50ml @ $0.60 from Batch 2 = $30.00 total
Total cost: $80.00
```

## Insufficient Stock Handling

When required quantity exceeds available stock, three recovery options are presented:

### 1. Partial Complete

Consume available stock and log shortage:

```typescript
await handlePartialComplete(database, error, taskId, idempotencyKey);
```

- Creates movements for available quantity
- Reason includes shortage amount: `"Partial deduction: consumed 25ml, shortage 25ml"`
- Task completes successfully

### 2. Skip Deduction

Complete task without updating inventory:

```typescript
await handleSkipDeduction(database, error, taskId, idempotencyKey);
```

- Creates zero-quantity marker movement
- Reason records insufficient stock: `"Skipped deduction due to insufficient stock"`
- Maintains audit trail without changing inventory

### 3. Adjust Inventory

Navigate user to add stock, then retry:

```typescript
const adjustData = prepareAdjustmentData(error);
// Show UI for adding new batch with required quantity
// After successful addition, retry deduction
```

## Idempotency

Prevents duplicate deductions on task retry or network failure:

```typescript
const result = await deduceInventory(database, {
  source: 'task',
  taskId: 'task-123',
  deductionMap: [...],
  idempotencyKey: 'unique-key-123', // Optional, auto-generated if omitted
});
```

- Same `idempotencyKey` returns existing movements without creating new ones
- Auto-generated keys use: `deduction:${taskId}:${timestamp}:${itemIds}`
- Server-side enforcement via Supabase `Idempotency-Key` header during sync

## Integration with Task Manager

Deduction happens automatically in `completeTask()`:

```typescript
// task-manager.ts
export async function completeTask(id: string): Promise<Task> {
  // ... update task status ...

  // Non-blocking inventory deduction
  try {
    const deductionMap = taskData.metadata?.deductionMap;
    if (deductionMap) {
      const result = await deduceInventory(database, {
        source: 'task',
        taskId: id,
        deductionMap,
        context: { taskId: id, plantCount: 1 },
      });

      if (!result.success) {
        console.warn('Inventory deduction failed:', result.error);
        // TODO: Surface to UI for recovery
      }
    }
  } catch (error) {
    console.warn('Inventory deduction failed:', error);
    // Task completes even if deduction fails
  }

  return task;
}
```

**Important**: Deduction failures are logged but don't block task completion.

## Consumption History

Query consumption history with filters:

```typescript
import { getConsumptionHistory } from '@/lib/inventory/consumption-history';

// Get all consumption for an item
const history = await getConsumptionHistory(database, {
  itemId: 'item-uuid',
  limit: 50,
});

// Get consumption for a specific task
const taskConsumption = await getConsumptionHistory(database, {
  taskId: 'task-uuid',
});

// Get consumption in date range
const rangeHistory = await getConsumptionHistory(database, {
  startDate: new Date('2025-10-01'),
  endDate: new Date('2025-10-31'),
  type: 'consumption',
});
```

### Consumption Summary

```typescript
import { getItemConsumptionSummary } from '@/lib/inventory/consumption-history';

const summary = await getItemConsumptionSummary(database, itemId, 30);
// {
//   totalQuantity: 500,
//   totalCostMinor: 25000, // $250.00 in cents
//   averagePerDay: 16.67,
//   entryCount: 15
// }
```

## Atomic Transactions

All deduction operations are atomic:

```typescript
await database.write(async () => {
  // 1. Update batch quantities
  // 2. Create consumption movements
  // 3. Link to task ID
  // All succeed or all fail (rollback)
});
```

**Rollback Guarantees**:

- Batch quantity update fails → no movements created
- Movement creation fails → batch quantities restored
- Network failure → local changes queued for retry

## Testing Deduction

### Unit Tests

Test individual components:

```typescript
import { validateDeductionMap } from '@/lib/inventory/deduction-validators';
import { pickBatchesForConsumption } from '@/lib/inventory/batch-picker';
import { calculateScaledQuantity } from '@/lib/inventory/scaling-calculator';
```

### Integration Tests

Test end-to-end workflow:

```typescript
import { deduceInventory } from '@/lib/inventory/deduction-service';

it('should deduce inventory on task completion', async () => {
  // Setup item + batch
  // Complete task with deduction map
  // Verify movements created
  // Verify batch quantity updated
});
```

## Best Practices

1. **Always set idempotency keys for server requests**: Prevents duplicate deductions on retry
2. **Validate deduction maps before saving**: Use `validateDeductionMap()` in forms
3. **Test with expired batches**: Ensure FEFO logic works correctly
4. **Monitor insufficient stock errors**: Track patterns to improve forecasting
5. **Use minor currency units**: Store costs in cents (integer) to avoid float drift
6. **Keep deduction maps simple**: Prefer fixed quantities over complex scaling logic
7. **Document scaling formulas**: EC-based calculations need clear documentation
8. **Test multi-batch scenarios**: Ensure FIFO costing works across batch boundaries

## Error Codes

- `VALIDATION_ERROR`: Deduction map validation failed
- `INSUFFICIENT_STOCK`: Not enough stock available
- `BATCH_EXPIRED`: Attempting to use expired batch without override
- `UNIT_MISMATCH`: Deduction unit doesn't match item unit
- `MISSING_ITEM`: Referenced item not found

## Future Enhancements

- **Multi-plant task support**: Track plant count in task metadata
- **Advanced nutrient calculations**: Full N-P-K ratio mixing with nutrient engine
- **UI for insufficient stock recovery**: Modal/bottom-sheet for user choice
- **Batch reservation system**: Reserve stock for planned tasks
- **Forecasting integration**: Predict stockouts based on schedule
- **Waste tracking**: Record expired/damaged inventory with reason codes
- **Cost variance reporting**: Compare FIFO vs weighted average costing

## See Also

- [Batch Management Guide](./batch-management.md)
- [Inventory Models Documentation](../watermelon-models/inventory-item.ts)
- [Task Manager Integration](../task-manager.ts)
- [FEFO/FIFO Policy Requirements](../../.kiro/specs/16.inventory-and-consumables/requirements.md)
