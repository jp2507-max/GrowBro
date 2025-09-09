# Design Document

## Overview

The Inventory and Consumables system is designed as an offline-first, high-performance inventory management solution for cultivation supplies. The architecture leverages WatermelonDB for local storage, Supabase for cloud sync, and implements sophisticated inventory policies (FEFO for picking, FIFO for costing) with real-time consumption tracking integrated into existing harvest and feeding workflows.

The system prioritizes performance with <300ms load times for 1,000+ items, 60fps scrolling using FlashList, and comprehensive offline functionality. All inventory operations are atomic, idempotent, and maintain full audit trails through immutable movement records.

## Architecture

### High-Level Architecture

The inventory system follows a layered architecture pattern with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ Inventory Lists │  │ Item Management │  │ CSV Import/  │ │
│  │ (FlashList)     │  │ Forms          │  │ Export       │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                    Business Logic Layer                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ Inventory       │  │ Batch           │  │ Consumption  │ │
│  │ Service         │  │ Management      │  │ Tracking     │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ FEFO/FIFO       │  │ Stock Level     │  │ Forecasting  │ │
│  │ Policies        │  │ Monitoring      │  │ Engine       │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                      Data Layer                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ WatermelonDB    │  │ Supabase Sync   │  │ Local        │ │
│  │ (Local SQLite)  │  │ Service         │  │ Notifications│ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Offline-First Design

The system implements a robust offline-first architecture with Expo-specific constraints:

- **Local Storage**: WatermelonDB provides SQLite-based local storage with reactive queries (requires development build/config plugin)
- **Sync Strategy**: Bidirectional sync using pullChanges/pushChanges with cursor pagination and updated_at timestamps
- **Conflict Resolution**: Last-Write-Wins (LWW) using server-side updated_at triggers with user-friendly conflict resolution UI
- **Data Integrity**: All operations are atomic with proper rollback on failures
- **Background Limitations**: Low-stock checks run on app start/resume + scheduled local notifications (background fetch is constrained on Expo - killed apps, iOS reboot, Android exact alarm permission)

### Performance Considerations

- **List Rendering**: FlashList for 60fps scrolling with 1,000+ items
- **Query Optimization**: Proper indexing on user_id, item_id, expires_on, created_at
- **Batch Operations**: Chunked sync payloads ≤2MB for large datasets
- **Caching**: Offline search index for instant results without network

## Components and Interfaces

### Core Data Models

#### InventoryItem Model

```typescript
interface InventoryItem {
  id: string;
  user_id: string;
  name: string;
  category: InventoryCategory;
  unit_of_measure: string; // SI units preferred
  tracking_mode: 'simple' | 'batched';
  is_consumable: boolean;
  min_stock: number;
  reorder_multiple: number; // pack size
  lead_time_days?: number;
  sku?: string;
  barcode?: string;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}
```

#### InventoryBatch Model

```typescript
interface InventoryBatch {
  id: string;
  item_id: string;
  lot_number: string;
  expires_on?: Date;
  quantity: number;
  cost_per_unit_minor: number; // stored in cents to avoid float drift
  received_at: Date;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}
```

#### InventoryMovement Model

```typescript
interface InventoryMovement {
  id: string;
  item_id: string;
  batch_id?: string;
  type: 'receipt' | 'consumption' | 'adjustment';
  quantity_delta: number;
  cost_per_unit_minor: number;
  reason: string;
  task_id?: string; // link to harvest/feeding tasks
  external_key?: string; // for idempotency
  created_at: Date;
}
```

### Service Layer Interfaces

#### InventoryService

```typescript
interface InventoryService {
  // Item Management
  createItem(item: CreateInventoryItemRequest): Promise<InventoryItem>;
  updateItem(
    id: string,
    updates: UpdateInventoryItemRequest
  ): Promise<InventoryItem>;
  deleteItem(id: string): Promise<void>;
  getItems(filters?: InventoryFilters): Promise<InventoryItem[]>;

  // Batch Management
  addBatch(itemId: string, batch: CreateBatchRequest): Promise<InventoryBatch>;
  getBatches(itemId: string): Promise<InventoryBatch[]>;
  consumeFromBatches(
    itemId: string,
    quantity: number,
    reason: string,
    options?: {
      source: 'task' | 'manual' | 'import';
      idempotencyKey?: string;
      allowExpiredOverride?: boolean;
    }
  ): Promise<ConsumptionResult>;

  // Stock Monitoring
  checkLowStock(): Promise<LowStockItem[]>;
  calculateStockForecast(itemId: string): Promise<StockForecast>;

  // CSV Operations (RFC 4180 + UTF-8 + ISO-8601 dates)
  exportToCSV(): Promise<CSVExportResult>; // exports items.csv, batches.csv, movements.csv
  importFromCSV(file: File): Promise<ImportResult>; // dry-run preview, idempotent by external_key
}
```

#### BatchPickingService

```typescript
interface BatchPickingService {
  // FEFO (First-Expire-First-Out) for picking - excludes expired by default
  getAvailableBatches(
    itemId: string,
    options?: {
      includeExpired?: boolean;
      minShelfDays?: number;
    }
  ): Promise<InventoryBatch[]>;

  // Picking with explicit edge case handling
  pickQuantity(
    itemId: string,
    quantity: number,
    options?: {
      allowExpiredOverride?: boolean;
      fallbackToFIFO?: boolean; // when no expiries exist
    }
  ): Promise<PickResult>;

  // FIFO costing for accounting - cost from picked batch at time of consumption
  calculateCostOfGoods(movements: InventoryMovement[]): Promise<CostAnalysis>;
}
```

### UI Component Architecture

#### InventoryList Component

```typescript
interface InventoryListProps {
  items: InventoryItem[];
  onItemPress: (item: InventoryItem) => void;
  onLowStockPress: (items: LowStockItem[]) => void;
  searchQuery?: string;
  categoryFilter?: InventoryCategory;
}
```

#### ItemDetail Component

```typescript
interface ItemDetailProps {
  item: InventoryItem;
  batches: InventoryBatch[];
  movements: InventoryMovement[];
  onUpdateStock: (quantity: number, reason: string) => void;
  onAddBatch: (batch: CreateBatchRequest) => void;
}
```

## Data Models

### Database Schema

#### Supabase Tables

```sql
-- Inventory Items Table
CREATE TABLE inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  unit_of_measure TEXT NOT NULL,
  tracking_mode TEXT NOT NULL CHECK (tracking_mode IN ('simple', 'batched')),
  is_consumable BOOLEAN NOT NULL DEFAULT true,
  min_stock DECIMAL(10,3) NOT NULL DEFAULT 0,
  reorder_multiple DECIMAL(10,3) NOT NULL DEFAULT 1,
  lead_time_days INTEGER,
  sku TEXT,
  barcode TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- auto-updated via trigger
  deleted_at TIMESTAMPTZ,

  CONSTRAINT positive_min_stock CHECK (min_stock >= 0),
  CONSTRAINT positive_reorder_multiple CHECK (reorder_multiple > 0)
);

-- Inventory Batches Table
CREATE TABLE inventory_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  lot_number TEXT NOT NULL,
  expires_on DATE,
  quantity DECIMAL(10,3) NOT NULL,
  cost_per_unit_minor INTEGER NOT NULL, -- stored in minor units (cents), no floats
  received_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- auto-updated via trigger
  deleted_at TIMESTAMPTZ,

  CONSTRAINT positive_quantity CHECK (quantity >= 0),
  CONSTRAINT positive_cost CHECK (cost_per_unit_minor >= 0)
);

-- Inventory Movements Table
CREATE TABLE inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES inventory_items(id),
  batch_id UUID REFERENCES inventory_batches(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('receipt', 'consumption', 'adjustment')),
  quantity_delta DECIMAL(10,3) NOT NULL,
  cost_per_unit_minor INTEGER, -- can be null for adjustments only
  reason TEXT NOT NULL,
  task_id UUID, -- references tasks table
  external_key TEXT, -- for idempotency
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(external_key) WHERE external_key IS NOT NULL,

  -- Movement consistency checks
  CONSTRAINT chk_qty_by_type CHECK (
    (type = 'receipt' AND quantity_delta > 0) OR
    (type = 'consumption' AND quantity_delta < 0) OR
    (type = 'adjustment' AND quantity_delta <> 0)
  ),
  CONSTRAINT chk_cost_required CHECK (
    type = 'adjustment' OR cost_per_unit_minor IS NOT NULL
  )
);

-- Auto-update updated_at triggers
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END
$$;

CREATE TRIGGER trg_items_updated_at
  BEFORE UPDATE ON inventory_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_batches_updated_at
  BEFORE UPDATE ON inventory_batches
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

#### Indexes for Performance

```sql
-- Composite indexes matching common filter patterns (equality predicate first)
CREATE INDEX idx_items_user_category ON inventory_items(user_id, category) WHERE deleted_at IS NULL;
CREATE INDEX idx_items_user_id ON inventory_items(user_id) WHERE deleted_at IS NULL;

CREATE INDEX idx_batches_item_expire ON inventory_batches(item_id, expires_on) WHERE deleted_at IS NULL;
CREATE INDEX idx_batches_item_id ON inventory_batches(item_id) WHERE deleted_at IS NULL;

CREATE INDEX idx_movements_item_id ON inventory_movements(item_id);
CREATE INDEX idx_movements_created_at ON inventory_movements(created_at);
CREATE INDEX idx_movements_task_id ON inventory_movements(task_id) WHERE task_id IS NOT NULL;

-- Partial unique index for soft deletes (allows reusing lot numbers after deletion)
CREATE UNIQUE INDEX uq_batches_item_lot_active
  ON inventory_batches(item_id, lot_number)
  WHERE deleted_at IS NULL;
```

#### Row Level Security (RLS)

```sql
-- Enable RLS
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

-- Split RLS policies per command with USING + WITH CHECK for proper validation
-- Inventory Items
CREATE POLICY "items_select" ON inventory_items
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "items_insert" ON inventory_items
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "items_update" ON inventory_items
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "items_delete" ON inventory_items
  FOR DELETE USING (user_id = auth.uid());

-- Inventory Batches
CREATE POLICY "batches_select" ON inventory_batches
  FOR SELECT USING (
    item_id IN (SELECT id FROM inventory_items WHERE user_id = auth.uid())
  );
CREATE POLICY "batches_insert" ON inventory_batches
  FOR INSERT WITH CHECK (
    item_id IN (SELECT id FROM inventory_items WHERE user_id = auth.uid())
  );
CREATE POLICY "batches_update" ON inventory_batches
  FOR UPDATE USING (
    item_id IN (SELECT id FROM inventory_items WHERE user_id = auth.uid())
  ) WITH CHECK (
    item_id IN (SELECT id FROM inventory_items WHERE user_id = auth.uid())
  );
CREATE POLICY "batches_delete" ON inventory_batches
  FOR DELETE USING (
    item_id IN (SELECT id FROM inventory_items WHERE user_id = auth.uid())
  );

-- Inventory Movements
CREATE POLICY "movements_select" ON inventory_movements
  FOR SELECT USING (
    item_id IN (SELECT id FROM inventory_items WHERE user_id = auth.uid())
  );
CREATE POLICY "movements_insert" ON inventory_movements
  FOR INSERT WITH CHECK (
    item_id IN (SELECT id FROM inventory_items WHERE user_id = auth.uid())
  );
CREATE POLICY "movements_delete" ON inventory_movements
  FOR DELETE USING (
    item_id IN (SELECT id FROM inventory_items WHERE user_id = auth.uid())
  );
```

### WatermelonDB Models

```typescript
// WatermelonDB Model Definitions with proper sync support
@model('inventory_items')
export class InventoryItem extends Model {
  static table = 'inventory_items';

  @text('name') name!: string;
  @text('category') category!: string;
  @text('unit_of_measure') unitOfMeasure!: string;
  @text('tracking_mode') trackingMode!: 'simple' | 'batched';
  @field('is_consumable') isConsumable!: boolean;
  @field('min_stock') minStock!: number;
  @field('reorder_multiple') reorderMultiple!: number;
  @field('lead_time_days') leadTimeDays?: number;
  @text('sku') sku?: string;
  @text('barcode') barcode?: string;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
  @date('deleted_at') deletedAt?: Date;

  @children('inventory_batches') batches!: Query<InventoryBatch>;
  @children('inventory_movements') movements!: Query<InventoryMovement>;
}

@model('inventory_batches')
export class InventoryBatch extends Model {
  static table = 'inventory_batches';

  @text('lot_number') lotNumber!: string;
  @date('expires_on') expiresOn?: Date;
  @field('quantity') quantity!: number;
  @field('cost_per_unit_minor') costPerUnitMinor!: number; // minor units, no floats
  @date('received_at') receivedAt!: Date;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
  @date('deleted_at') deletedAt?: Date;

  @relation('inventory_items', 'item_id') item!: Relation<InventoryItem>;
  @children('inventory_movements') movements!: Query<InventoryMovement>;
}

@model('inventory_movements')
export class InventoryMovement extends Model {
  static table = 'inventory_movements';

  @text('type') type!: 'receipt' | 'consumption' | 'adjustment';
  @field('quantity_delta') quantityDelta!: number;
  @field('cost_per_unit_minor') costPerUnitMinor?: number; // can be null for adjustments
  @text('reason') reason!: string;
  @text('task_id') taskId?: string;
  @text('external_key') externalKey?: string; // for idempotency

  @readonly @date('created_at') createdAt!: Date;

  @relation('inventory_items', 'item_id') item!: Relation<InventoryItem>;
  @relation('inventory_batches', 'batch_id') batch?: Relation<InventoryBatch>;
}
```

## Error Handling

### Error Categories and Responses

#### Validation Errors

```typescript
interface ValidationError {
  code: 'VALIDATION_ERROR';
  field: string;
  message: string;
  value: any;
}

// Example validation errors
const validationErrors = {
  INVALID_QUANTITY: 'Quantity must be a positive number',
  INVALID_UNIT: 'Unit of measure is required',
  INVALID_CATEGORY: 'Category must be one of the predefined values',
  EXPIRED_BATCH: 'Cannot consume from expired batch without override',
  INSUFFICIENT_STOCK: 'Insufficient stock available for consumption',
};
```

#### Business Logic Errors

```typescript
interface BusinessError {
  code: 'BUSINESS_ERROR';
  type: 'INSUFFICIENT_STOCK' | 'BATCH_EXPIRED' | 'DUPLICATE_LOT';
  message: string;
  context: Record<string, any>;
  recoveryOptions: RecoveryOption[];
}

interface RecoveryOption {
  action: string;
  label: string;
  data?: any;
}
```

#### Sync Errors

```typescript
interface SyncError {
  code: 'SYNC_ERROR';
  type: 'NETWORK_ERROR' | 'CONFLICT' | 'SERVER_ERROR';
  message: string;
  retryable: boolean;
  conflictData?: ConflictData;
}

interface ConflictData {
  localVersion: any;
  remoteVersion: any;
  conflictMessage: string; // "Last write wins; your change overwritten by device X at <timestamp>"
  reapplyAction?: () => Promise<void>; // "Reapply my change" functionality
}
```

### Error Recovery Strategies

#### Insufficient Stock Handling

```typescript
interface InsufficientStockOptions {
  partialComplete: {
    availableQuantity: number;
    action: () => Promise<void>;
  };
  skipDeduction: {
    reason: string;
    action: () => Promise<void>;
  };
  adjustInventory: {
    requiredQuantity: number;
    action: (newQuantity: number) => Promise<void>;
  };
}
```

#### Conflict Resolution

```typescript
interface ConflictResolution {
  strategy: 'LAST_WRITE_WINS' | 'MANUAL_MERGE';
  localVersion: any;
  remoteVersion: any;
  resolvedVersion?: any;
  userAction?: 'ACCEPT_REMOTE' | 'KEEP_LOCAL' | 'MANUAL_EDIT';
}
```

## Testing Strategy

### Unit Testing Approach

#### Model Testing

- Test all validation rules and constraints
- Verify FEFO/FIFO logic with edge cases
- Test batch expiration handling
- Validate cost calculations with minor currency units

#### Service Layer Testing

```typescript
describe('InventoryService', () => {
  describe('consumeFromBatches', () => {
    it('should consume from oldest expiring batch first (FEFO)', async () => {
      // Test FEFO picking logic
    });

    it('should calculate cost using FIFO method', async () => {
      // Test FIFO costing
    });

    it('should handle insufficient stock gracefully', async () => {
      // Test error scenarios
    });
  });
});
```

#### Integration Testing

- Test task workflow integration
- Verify sync operations with Supabase
- Test CSV import/export end-to-end
- Validate offline scenarios

### Performance Testing

#### Load Testing Scenarios

```typescript
const performanceTests = {
  largeDataset: {
    items: 1000,
    batchesPerItem: 5,
    movementsPerItem: 20,
    expectedLoadTime: '<300ms',
  },
  scrollPerformance: {
    listSize: 1000,
    expectedFPS: 60,
    component: 'FlashList',
  },
  syncPerformance: {
    payloadSize: '2MB',
    expectedSyncTime: '<5s',
    conflictResolution: '<1s',
  },
};
```

#### Memory and Battery Testing

- Monitor memory usage with large datasets
- Test battery impact of background sync
- Validate performance on mid-tier Android devices

### Edge Case Testing

#### FEFO/FIFO Edge Cases

- Multiple batches with same expiration date
- Expired batches with override scenarios
- Partial consumption across multiple batches
- Cost calculation with mixed batch costs

#### Offline Scenarios

```typescript
const offlineTests = {
  createItemOffline:
    'Create item → Add batch → Consume via task → Sync on reconnect',
  conflictResolution: 'Simultaneous edits on multiple devices',
  largeOfflineQueue: 'Multiple operations queued for sync',
  syncFailureRecovery: 'Handle partial sync failures gracefully',
};
```

#### Idempotency Testing

- Duplicate task submissions
- Repeated CSV imports
- Network retry scenarios
- Concurrent operation handling

#

## Enhanced Performance and Monitoring Requirements

#### Performance Benchmarks

```typescript
const performanceRequirements = {
  largeDataset: {
    items: 1000,
    batchesPerItem: 5,
    movementsPerItem: 20,
    expectedLoadTime: '<300ms', // cold-load on Moto G-class device
    component: 'FlashList v2', // JS-only, better precision with stable keys
  },
  scrollPerformance: {
    listSize: 1000,
    expectedFPS: 60, // on low-end Android
    stableKeys: true,
    getItemType: true, // for FlashList optimization
  },
  syncPerformance: {
    payloadSize: '2MB',
    expectedSyncTime: '<5s',
    conflictResolution: '<1s',
    metrics: [
      'last_pulled_at',
      'pull/push durations',
      'payload KB',
      'mutation queue length',
      'conflicts',
    ],
  },
};
```

#### Notification System Constraints

```typescript
const notificationRequirements = {
  exactAlarmPermission: {
    platform: 'Android 13+',
    permission: 'SCHEDULE_EXACT_ALARM',
    fallback: 'inexact alarms + in-app banners on open/resume',
    testing: 'device-matrix tests with/without permission',
  },
  backgroundLimitations: {
    expo: 'background fetch constrained (killed apps, iOS reboot)',
    strategy:
      'low-stock checks on app start/resume + scheduled local notifications',
    acceptance:
      'Low-stock banner refreshes on app open/resume within 1s; background checks are best-effort only',
  },
  deliveryMetrics: {
    logDeliveryLag: true,
    testMatrix: 'various device states and OS versions',
  },
};
```

#### Sync Telemetry and Monitoring

```typescript
const syncMetrics = {
  required: [
    'last_pulled_at timestamp',
    'sync duration (pull/push separately)',
    'payload size in KB',
    'pending mutations count',
    'conflict count and resolution time',
  ],
  conflictHandling: {
    strategy: 'Last-Write-Wins via updated_at timestamps',
    userFeedback:
      'Last write wins; your change overwritten by device X at <timestamp>',
    reapplyAction: 'One-tap "Reapply my change" creates fresh mutation',
  },
  offlineScenarios: [
    'create item → add batch → consume via task → resolve on reconnect',
    'simultaneous edits on multiple devices',
    'large offline queue with partial sync failures',
  ],
};
```

#### CSV Import/Export Standards

```typescript
const csvRequirements = {
  format: 'RFC 4180 compliant UTF-8',
  dateFormat: 'ISO-8601 (YYYY-MM-DD)',
  numberFormat: 'dot decimals',
  files: ['items.csv', 'batches.csv', 'movements.csv'],
  idempotency: 'by external_key',
  validation: 'dry-run preview with row-level diffs and validation errors',
  acceptance: 'Re-importing the same file yields 0 net changes',
};
```

#### Low Stock Monitoring

```typescript
const lowStockRequirements = {
  sorting: 'days-to-zero (forecast) then % below threshold',
  forecasting:
    'Simple Moving Average (8-week) + Simple Exponential Smoothing (≥12 weeks data)',
  notifications: {
    trigger: 'on app start/resume + scheduled local notifications',
    permission: 'request SCHEDULE_EXACT_ALARM on Android 13+',
    fallback: 'inexact alarms when permission denied',
    display: 'badge on inventory tab + in-app banner',
  },
};
```
