# Inventory Telemetry Guide

**Last updated**: October 2025  
**Status**: Production-ready  
**Requirements**: 11.1, 11.2

---

## Overview

The inventory telemetry system provides comprehensive tracking for inventory operations including low-stock events, import errors, auto-deduction failures, batch operations, and CSV operations. All telemetry is consent-aware and routed through `NoopAnalytics` with minimal performance overhead (<1%).

## Available Metrics

### 1. Low Stock Events

**Event**: `inventory_low_stock`

**Emitted when**: Inventory falls to/below reorder point

**Payload**:

```typescript
{
  item_id: string;
  item_name: string;
  category: string;
  current_stock: number;
  min_stock: number;
  days_to_zero?: number;  // From forecasting engine
  unit: string;
}
```

**Usage**:

```typescript
import { trackLowStock } from '@/lib/inventory/telemetry';

await trackLowStock({
  itemId: '123',
  itemName: 'Bloom Nutrient',
  category: 'Nutrients',
  currentStock: 50,
  minStock: 100,
  daysToZero: 3,
  unit: 'ml',
});
```

### 2. Import Errors

**Event**: `inventory_import_error`

**Emitted when**: CSV import encounters parse, validation, or transaction errors

**Payload**:

```typescript
{
  error_type: 'parse' | 'validation' | 'transaction';
  row_number?: number;
  field?: string;
  total_rows: number;
  error_count: number;
}
```

**Usage**:

```typescript
import { trackImportError } from '@/lib/inventory/telemetry';

// Parse error with row/field context
await trackImportError({
  errorType: 'parse',
  rowNumber: 5,
  field: 'quantity',
  totalRows: 100,
  errorCount: 1,
});

// Validation error without specific row
await trackImportError({
  errorType: 'validation',
  totalRows: 100,
  errorCount: 5,
});
```

### 3. Deduction Failures

**Event**: `inventory_deduction_failure`

**Emitted when**: Auto-deduction fails due to insufficient stock, validation, or transaction errors

**Payload**:

```typescript
{
  source: 'task' | 'manual' | 'import';
  failure_type: 'insufficient_stock' | 'validation' | 'transaction';
  item_id: string;
  item_name: string;
  required_quantity: number;
  available_quantity: number;
  unit: string;
  task_id?: string;
}
```

**Usage**:

```typescript
import { trackDeductionFailure } from '@/lib/inventory/telemetry';

await trackDeductionFailure({
  source: 'task',
  failureType: 'insufficient_stock',
  itemId: '123',
  itemName: 'Bloom Nutrient',
  requiredQuantity: 100,
  availableQuantity: 50,
  unit: 'ml',
  taskId: 'task-456',
});
```

### 4. Batch Expired Overrides

**Event**: `inventory_batch_expired_override`

**Emitted when**: User explicitly consumes from expired batch with reason

**Payload**:

```typescript
{
  batch_id: string;
  item_id: string;
  lot_number: string;
  expires_on: string;
  days_expired: number;
  reason: string;
}
```

**Usage**:

```typescript
import { trackBatchExpiredOverride } from '@/lib/inventory/telemetry';

await trackBatchExpiredOverride({
  batchId: 'batch-123',
  itemId: 'item-123',
  lotNumber: 'LOT-001',
  expiresOn: '2025-01-01',
  daysExpired: 10,
  reason: 'Emergency use - no alternative available',
});
```

### 5. Batch Operations

**Event**: `inventory_batch_operation`

**Emitted when**: Batch create/update/delete/consume operations occur

**Payload**:

```typescript
{
  operation: 'create' | 'update' | 'delete' | 'consume';
  item_id: string;
  quantity: number;
  unit: string;
  duration_ms?: number;
}
```

**Usage**:

```typescript
import { trackBatchOperation } from '@/lib/inventory/telemetry';

await trackBatchOperation({
  operation: 'consume',
  itemId: 'item-123',
  quantity: 100,
  unit: 'ml',
  durationMs: 45,
});
```

### 6. CSV Operations

**Event**: `inventory_csv_operation`

**Emitted when**: CSV export/import/preview operations complete

**Payload**:

```typescript
{
  operation: 'export' | 'import' | 'preview';
  row_count: number;
  success_count?: number;
  error_count?: number;
  duration_ms: number;
}
```

**Usage**:

```typescript
import { trackCSVOperation } from '@/lib/inventory/telemetry';

await trackCSVOperation({
  operation: 'import',
  rowCount: 100,
  successCount: 95,
  errorCount: 5,
  durationMs: 850,
});
```

---

## Performance Characteristics

### Overhead Targets

- **Low-stock checks**: <1% overhead on stock monitoring operations
- **Deduction failures**: <1% overhead on deduction operations
- **Import operations**: <1% overhead on CSV import/export
- **Batch operations**: <1% overhead on batch CRUD operations

### Test Results

All telemetry functions meet the <1% overhead target:

```bash
pnpm test telemetry-performance

✓ Low Stock Tracking Overhead
  ✓ should have <1% overhead on stock checks
✓ Deduction Failure Tracking Overhead
  ✓ should have <1% overhead on deduction failures
✓ Import Error Tracking Overhead
  ✓ should have <1% overhead on import operations
✓ CSV Operation Tracking Overhead
  ✓ should have <1% overhead on CSV export
✓ Batch Operation Tracking Overhead
  ✓ should have <1% overhead on batch operations
```

### High-Frequency Events

The system handles rapid event bursts efficiently:

- 50 events in <250ms (avg <5ms per event)
- No memory leaks with 1,000+ events (<100KB increase)
- Async fire-and-forget pattern prevents blocking

---

## Dashboard Queries

### Sentry Dashboard Queries

```javascript
// Low stock events in last 24h
event.type:"inventory_low_stock" AND timestamp:[now-24h TO now]

// Import error rate by type
event.type:"inventory_import_error" AND event.data.error_type:*

// Deduction failures by source
event.type:"inventory_deduction_failure" AND event.data.source:*

// Insufficient stock failures
event.type:"inventory_deduction_failure" AND event.data.failure_type:"insufficient_stock"

// Task-triggered deduction failures
event.type:"inventory_deduction_failure" AND event.data.source:"task" AND event.data.task_id:*

// CSV operations performance
event.type:"inventory_csv_operation" AND event.data.duration_ms:>1000

// Batch expired overrides
event.type:"inventory_batch_expired_override"
```

### Metric Aggregations

```javascript
// Average import duration
avg(inventory_csv_operation.duration_ms) by operation

// Deduction failure rate by type
count(inventory_deduction_failure) by failure_type

// Low stock event frequency
count(inventory_low_stock) by category

// Import error rate
(count(inventory_import_error) / count(inventory_csv_operation)) * 100
```

---

## Alert Thresholds

### Recommended Thresholds

| Metric                      | Warning  | Critical | Action                            |
| --------------------------- | -------- | -------- | --------------------------------- |
| Low stock events            | >10/hour | >50/hour | Review reorder points             |
| Import error rate           | >5%      | >10%     | Investigate CSV format compliance |
| Deduction failure rate      | >3%      | >10%     | Check inventory accuracy          |
| Insufficient stock failures | >5/hour  | >20/hour | Urgent reorder needed             |
| CSV operation duration      | >2s      | >5s      | Optimize import/export            |

### Alert Configuration

**Sentry Metric Alerts**:

1. **High Deduction Failure Rate**
   - Query: `count(inventory_deduction_failure) by failure_type`
   - Threshold: >10 in 1 hour
   - Action: Page on-call engineer

2. **Import Error Spike**
   - Query: `count(inventory_import_error)`
   - Threshold: >5 in 10 minutes
   - Action: Notify inventory team

3. **Critical Stock Shortage**
   - Query: `count(inventory_low_stock) where days_to_zero < 2`
   - Threshold: >5 in 1 hour
   - Action: Alert supply chain team

---

## Integration Points

### Existing Services Integration

Telemetry is integrated at the following points:

1. **Deduction Service** (`src/lib/inventory/deduction-service.ts`)
   - Tracks insufficient stock failures with item/quantity context
   - Called in `collectInsufficientStockErrors()` function

2. **CSV Import Service** (`src/lib/inventory/csv-import-service.ts`)
   - Tracks preview, import, and error operations
   - Called in `previewCSVImport()` and `executeCSVImport()` functions

3. **CSV Parser** (`src/lib/inventory/csv-parser.ts`)
   - Can integrate parse error tracking if needed

4. **Batch Picker** (`src/lib/inventory/batch-picker.ts`)
   - Can integrate expired override tracking

### Adding New Telemetry Points

To add telemetry to new operations:

1. **Import the telemetry function**:

   ```typescript
   import { trackLowStock } from '@/lib/inventory/telemetry';
   ```

2. **Call at the appropriate point** (fire-and-forget):

   ```typescript
   void trackLowStock({ itemId, itemName, ... });
   ```

3. **Add test coverage**:
   ```typescript
   expect(trackLowStock).toHaveBeenCalledWith({ ... });
   ```

---

## Privacy & Consent

### Consent-Aware Tracking

All telemetry routes through `NoopAnalytics`, which respects user analytics consent:

- **Consent granted**: Events forwarded to configured analytics provider
- **Consent denied**: Events dropped silently (no-op)
- **Consent withdrawn**: Listeners removed, no further tracking

### PII Handling

The telemetry system follows these PII guidelines:

- ✅ **Safe**: item IDs, categories, quantities, durations
- ✅ **Safe**: error types, operation names, aggregate counts
- ⚠️ **Caution**: item names (sanitized via analytics layer)
- ❌ **Avoid**: user IDs, task notes, batch lot numbers with personal identifiers

---

## Testing

### Accuracy Tests

Run accuracy tests to verify event data:

```bash
pnpm test telemetry-accuracy
```

Validates:

- Event payloads match expected schema
- All required fields present
- Error handling doesn't throw
- Multiple events tracked independently

### Performance Tests

Run performance tests to verify overhead:

```bash
pnpm test telemetry-performance
```

Validates:

- <1% overhead on all operations
- High-frequency burst handling
- No memory leaks
- Fast error recovery

---

## Troubleshooting

### Events Not Appearing

1. **Check consent status**:

   ```typescript
   import { hasConsent } from '@/lib/privacy-consent';
   console.log('Analytics consent:', hasConsent('analytics'));
   ```

2. **Verify NoopAnalytics wiring**:

   ```typescript
   import { NoopAnalytics } from '@/lib/analytics';
   console.log('NoopAnalytics:', NoopAnalytics);
   ```

3. **Check Sentry DSN configuration**:
   - Ensure `SENTRY_DSN` environment variable is set
   - Verify release tracking enabled

### High Performance Overhead

If telemetry causes >1% overhead:

1. **Check event frequency**: Reduce high-frequency event tracking
2. **Batch events**: Consider aggregating rapid events before tracking
3. **Review payload size**: Minimize data in event payloads

### Memory Leaks

If memory usage increases with telemetry:

1. **Check for closures**: Ensure no captured references in telemetry calls
2. **Verify async cleanup**: All promises resolve/reject properly
3. **Review error handling**: Failed events cleaned up correctly

---

## Maintenance

### Adding New Event Types

1. **Update `src/lib/analytics.ts`**:

   ```typescript
   export type AnalyticsEvents = {
     // ...existing events
     inventory_new_event: {
       field1: string;
       field2: number;
     };
   };
   ```

2. **Add telemetry function in `src/lib/inventory/telemetry.ts`**:

   ```typescript
   export async function trackNewEvent(event: NewEvent): Promise<void> {
     try {
       await NoopAnalytics.track('inventory_new_event', {
         field1: event.field1,
         field2: event.field2,
       });
     } catch (error) {
       if (__DEV__) {
         console.warn(
           '[Inventory Telemetry] Failed to track new event:',
           error
         );
       }
     }
   }
   ```

3. **Add type definition in `src/lib/inventory/telemetry-types.ts`**

4. **Add tests in `src/lib/inventory/__tests__/telemetry-accuracy.test.ts`**

5. **Update this documentation**

---

## Related Documentation

- [Inventory Error Handling Guide](./inventory-error-handling-guide.md)
- [Sentry Privacy Configuration](./sentry-privacy-configuration.md)
- [Playbook Analytics System](../src/lib/playbooks/analytics/README.md)
- [Sync Analytics](../src/lib/sync/sync-analytics.ts)

---

## Support

For questions or issues:

- GitHub Issues: Tag `inventory` and `telemetry`
- Slack: `#inventory-telemetry` channel
- On-call: Page via PagerDuty for critical telemetry failures
