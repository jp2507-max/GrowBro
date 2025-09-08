# Requirements Document

## Introduction

The Inventory and Consumables feature provides comprehensive tracking and management of cultivation supplies, nutrients, seeds, and other consumable items used in growing operations. This system enables growers to maintain accurate inventory levels, track consumption patterns, automate stock depletion from harvest and feeding workflows, and forecast future supply needs. The feature integrates with existing harvest and feeding workflows to provide real-time inventory updates and supports both manual entry and CSV import/export for inventory management.

The system uses FEFO (First-Expire-First-Out) for availability and consumption ordering while maintaining FIFO cost valuation for accounting. All inventory changes are recorded as immutable movements for reconciliation and sync. The feature is designed for offline-first operation with WatermelonDB local storage and Supabase sync.

## Requirements

### Requirement 1

**User Story:** As a grower, I want to manage my inventory of consumable items (nutrients, seeds, soil amendments, etc.), so that I can track what supplies I have available and when I need to reorder.

#### Acceptance Criteria

1. WHEN a user accesses the inventory section THEN the system SHALL display a list of all inventory items with current stock levels rendering in <300ms for ≥1,000 items and scrolling at 60fps on mid-tier Android devices using FlashList
2. WHEN a user adds a new inventory item THEN the system SHALL require item name, category, unit_of_measure (SI units where possible), tracking_mode (simple vs batched), is_consumable flag, reorder_multiple (pack size), and optional SKU/barcode
3. WHEN a user views an inventory item THEN the system SHALL display item details including name, category, current stock, minimum stock threshold, unit cost, total value, and tracking mode
4. WHEN a user updates inventory quantities THEN the system SHALL create an immutable inventory_movement record with type ∈ {adjustment, receipt, consumption}, timestamp, and reason in a single atomic transaction
5. WHEN adding an item with initial stock THEN the system SHALL create both the item and first batch in one atomic write operation
6. IF an inventory item reaches or falls below minimum stock threshold THEN the system SHALL display a low stock warning with validation rules enforced for units and precision

### Requirement 2

**User Story:** As a grower, I want to organize my inventory into batches with expiration dates and lot numbers, so that I can use older stock first and track product quality.

#### Acceptance Criteria

1. WHEN a user adds inventory stock THEN the system SHALL allow creation of batches with lot number, expiration date, quantity, cost_per_unit, and received_at timestamp
2. WHEN a user views an inventory item THEN the system SHALL display all batches sorted by expiration date using FEFO (First-Expire-First-Out) ordering for availability
3. WHEN inventory is consumed THEN the system SHALL automatically deduct from batches using FEFO for picking while maintaining FIFO cost valuation for accounting
4. WHEN a batch expires THEN the system SHALL exclude it from available stock calculations but keep it visible with expiry warnings and allow explicit override with reason
5. WHEN a user manually adjusts batch quantities THEN the system SHALL support partial-batch consumption with precise remaining quantity updates and require a reason for all adjustments
6. WHEN expired batches are accessed THEN the system SHALL display warning "Expired on <date>. Excluded from auto-picking (FEFO). Override?" and allow manual selection with justification

### Requirement 3

**User Story:** As a grower, I want inventory to automatically decrease when I complete harvest or feeding tasks, so that my stock levels stay accurate without manual updates.

#### Acceptance Criteria

1. WHEN a user completes a feeding task with specified nutrient amounts THEN the system SHALL automatically deduct those amounts using deduction maps on task templates (item + unit + per-task quantity) with support for per-plant scaling via plant size or EC/ppm
2. WHEN a user completes a harvest task THEN the system SHALL automatically deduct any consumables used (containers, labels, etc.) based on predefined task template mappings
3. WHEN automatic deduction occurs THEN the system SHALL create consumption movements and update item/batch quantities in a single atomic transaction with task_id linkage and use Idempotency-Key for repeat submissions
4. IF insufficient inventory exists for a task THEN the system SHALL offer three choices: (a) partial complete (consumes available, logs shortage), (b) skip deduction (logs soft fail), (c) adjust inventory now - all paths create movements linked to task ID
5. WHEN a user views consumption history THEN the system SHALL display all automatic and manual consumption entries with dates, quantities, associated tasks, and cost per unit from batch at time of consumption
6. WHEN deduction failures occur THEN the system SHALL roll back all changes in the transaction and provide clear error messaging with recovery options

### Requirement 4

**User Story:** As a grower, I want to set minimum stock levels for items and receive notifications when supplies are running low, so that I can reorder before running out.

#### Acceptance Criteria

1. WHEN a user sets up an inventory item THEN the system SHALL allow setting a reorder point (minimum stock), optional lead time days, and reorder multiple for calculating optimal order quantities
2. WHEN current stock falls to or below the reorder point THEN the system SHALL display a low stock indicator and trigger local notifications (no network required) with badge on inventory tab
3. WHEN viewing the inventory dashboard THEN the system SHALL show a summary of all low stock items prioritized by days-to-zero from forecast, then percentage below threshold
4. WHEN stock levels change THEN the system SHALL immediately update low stock status and recalculate days-to-zero based on consumption forecast
5. WHEN forecasting is available THEN the system SHALL compute days-to-zero from usage patterns and display next stockout date with reorder recommendations considering lead time and reorder multiples
6. WHEN multiple items are low on stock THEN the system SHALL sort by urgency (days-to-zero ascending) rather than just delta below threshold for actionable prioritization

### Requirement 5

**User Story:** As a grower, I want to import and export my inventory data via CSV files, so that I can bulk update inventory or backup my data.

#### Acceptance Criteria

1. WHEN a user initiates CSV export THEN the system SHALL generate RFC 4180 compliant UTF-8 files with header rows: items.csv (item data), batches.csv (batch data), and movements.csv (transaction history) using ISO-8601 dates and dot decimals
2. WHEN a user imports a CSV file THEN the system SHALL validate format compliance, display a dry-run preview showing row-level diffs and per-column validation errors before applying any changes
3. WHEN importing inventory data THEN the system SHALL support upsert operations by external_key/SKU for adding new items, updating existing quantities, and creating new batches with idempotent behavior
4. IF CSV import contains errors THEN the system SHALL display specific error messages with row and column references, allow inline correction, and prevent partial imports
5. WHEN CSV operations complete THEN the system SHALL provide a detailed summary of items added, updated, or skipped with change counts and ensure re-importing the same file yields zero net changes
6. WHEN CSV schema is used THEN the system SHALL follow the documented format with external_key as primary identifier, supporting items (external_key, name, category, unit, tracking_mode, min_stock, reorder_multiple, lead_time_days, sku), batches (external_key, item_external_key, lot, expires_on, qty, cost_per_unit_minor, received_at), and movements (external_key, item_external_key, batch_lot, type, qty_delta, reason, task_external_id, created_at)

### Requirement 6

**User Story:** As a grower, I want to view consumption history and usage patterns for my supplies, so that I can better plan future purchases and optimize my growing process.

#### Acceptance Criteria

1. WHEN a user views consumption history THEN the system SHALL display all consumption entries with dates, quantities, items, associated tasks, and cost per unit from batch at time of consumption
2. WHEN viewing an individual inventory item THEN the system SHALL show consumption trends over time with weekly bucket charts and next stockout date with 80% prediction interval when using Simple Exponential Smoothing
3. WHEN analyzing usage patterns THEN the system SHALL calculate consumption rates using 8-week Simple Moving Average (SMA) as default, with Simple Exponential Smoothing (SES) option for items with ≥12 weeks of data
4. WHEN viewing consumption data THEN the system SHALL allow filtering by date range, item category, consumption type, and provide cost analysis showing supply costs over time periods
5. WHEN forecasting is enabled THEN the system SHALL show reorder-by dates considering lead time and reorder multiples, using built-in moving-average and exponential smoothing with good defaults for low-noise demand patterns
6. WHEN insufficient historical data exists THEN the system SHALL default to 8-week SMA and clearly indicate forecast confidence levels

### Requirement 7

**User Story:** As a grower, I want my inventory data to sync across devices and work offline, so that I can update inventory in my grow space without internet connection.

#### Acceptance Criteria

1. WHEN inventory changes are made offline THEN the system SHALL store changes locally using WatermelonDB and sync via pullChanges/pushChanges when connection is restored with cursor pagination and idempotent upserts
2. WHEN multiple devices make conflicting changes THEN the system SHALL use last-write-wins (LWW) conflict resolution via updated_at timestamps and display "Last write wins; your change overwritten by device X at <timestamp>" with one-tap "Reapply my change" action
3. WHEN the app starts THEN the system SHALL sync inventory data from Supabase if connection is available and log metrics including last_pulled_at, sync duration, pending mutations count, and conflict count
4. WHEN viewing inventory offline THEN the system SHALL display the most recent cached data with clear offline indicator and ensure all CRUD operations and auto-deductions work in flight-mode
5. WHEN sync conflicts occur THEN the system SHALL surface conflicts with reapply options and maintain flight-mode QA scenarios for create item → add batch → consume via task → resolve on reconnect workflow
6. WHEN syncing large datasets THEN the system SHALL keep payloads ≤2MB and chunk if needed, using soft deletes with deleted_at tombstones and Row Level Security (RLS) with user_id = auth.uid()

### Requirement 8

**User Story:** As a grower, I want to categorize my inventory items (nutrients, seeds, tools, containers, etc.), so that I can organize and find supplies more easily.

#### Acceptance Criteria

1. WHEN adding inventory items THEN the system SHALL provide predefined categories (Nutrients, Seeds, Growing Media, Tools, Containers, Amendments) with editable taxonomy and facets including brand, N-P-K ratios (for nutrients), form (powder/liquid), and hazard flags for storage guidance
2. WHEN viewing inventory THEN the system SHALL allow filtering and grouping by category, brand, form, and hazard flags with faceted search capabilities
3. WHEN a user creates custom categories THEN the system SHALL save them for future use and allow category hierarchy management
4. WHEN viewing category summaries THEN the system SHALL display total value, item count per category, and breakdown by facets (brand, form, etc.)
5. WHEN searching inventory THEN the system SHALL index item name, SKU, category, tags, and brand with 150ms debounce and cache last query for offline access
6. WHEN using search offline THEN the system SHALL provide instant results from cached index without server roundtrips

### Requirement 9

**User Story:** As a grower, I want to track the cost and value of my inventory, so that I can understand my investment in supplies and calculate cost per harvest.

#### Acceptance Criteria

1. WHEN adding inventory items THEN the system SHALL allow entering unit cost stored in minor currency units (cents) to avoid float drift and calculate total value across all batches
2. WHEN viewing inventory summaries THEN the system SHALL display total inventory value by category and overall with real-time updates as stock levels change
3. WHEN consumption occurs THEN the system SHALL calculate cost using FIFO costing at batch level with each consumption movement carrying cost_per_unit from the specific batch at time of pick
4. WHEN viewing consumption history THEN the system SHALL display both quantity and cost of consumed items with cost per unit preserved from original batch valuation
5. WHEN generating reports THEN the system SHALL provide cost analysis showing supply costs over time (stacked by category) and cost per harvest (sum of linked movements) with currency handling in minor units throughout
6. WHEN batch costing is applied THEN the system SHALL avoid revaluation errors by maintaining cost_per_unit_minor at batch creation and using FIFO mechanics for cost flow while FEFO drives physical picking

### Requirement 10

**User Story:** As a system administrator, I want a robust data model that supports offline-first sync and maintains data integrity, so that inventory operations are reliable across all devices and network conditions.

#### Acceptance Criteria

1. WHEN designing the data model THEN the system SHALL implement three core tables: inventory_items (id, user_id, name, category, unit, tracking_mode, min_stock, reorder_multiple, lead_time_days, sku, updated_at, deleted_at), inventory_batches (id, item_id, lot, expires_on, qty, cost_per_unit_minor, received_at, updated_at, deleted_at), and inventory_movements (id, item_id, batch_id, type {receipt|consumption|adjustment}, qty_delta, cost_per_unit_minor, reason, task_id, created_at)
2. WHEN implementing sync THEN the system SHALL use Last-Write-Wins (LWW) via updated_at timestamps with soft deletes using deleted_at for tombstone records
3. WHEN applying Row Level Security THEN the system SHALL enforce user_id = auth.uid() for all inventory tables while keeping community tables public-read per product requirements
4. WHEN syncing data THEN the system SHALL use WatermelonDB synchronize() with pullChanges/pushChanges, cursor pagination, idempotent upserts, and handle tombstones for soft deletes
5. WHEN managing large datasets THEN the system SHALL keep sync payloads ≤2MB and implement chunking when needed
6. WHEN tracking changes THEN the system SHALL ensure 100% of inventory edits produce immutable movements for reconciliation and audit trails

### Requirement 11

**User Story:** As a developer, I want comprehensive telemetry and quality assurance measures, so that I can monitor system performance and quickly identify issues.

#### Acceptance Criteria

1. WHEN monitoring system performance THEN the system SHALL track metrics including sync duration, conflict count, low-stock events, import error rate, and auto-deduction failure rate
2. WHEN testing offline scenarios THEN the system SHALL validate flight-mode operations including create item → add batch → consume via task → resolve on reconnect workflows
3. WHEN handling edge cases THEN the system SHALL test duplicate task submissions (idempotency), FEFO edge cases (expired oldest vs near-expiry), and large list performance (1,000+ items)
4. WHEN providing user feedback THEN the system SHALL include undo affordances (15 second window) for destructive actions like delete batch and inventory adjustments
5. WHEN displaying warnings THEN the system SHALL show clear messages like "Expired on <date>. Excluded from auto-picking (FEFO). Override?" for expired batch access
6. WHEN errors occur THEN the system SHALL provide specific error messages with recovery options and maintain detailed logs for troubleshooting

### Requirement 12

**User Story:** As a system integrator, I want standardized CSV schemas and API contracts, so that data exchange is reliable and predictable.

#### Acceptance Criteria

1. WHEN defining CSV format THEN the system SHALL use RFC 4180 standard with UTF-8 encoding, required header rows, ISO-8601 dates (YYYY-MM-DD), and dot decimals for numbers
2. WHEN exporting data THEN the system SHALL provide three files: items.csv (external_key, name, category, unit, tracking_mode, min_stock, reorder_multiple, lead_time_days, sku), batches.csv (external_key, item_external_key, lot, expires_on, qty, cost_per_unit_minor, received_at), and movements.csv (external_key, item_external_key, batch_lot, type, qty_delta, reason, task_external_id, created_at)
3. WHEN importing data THEN the system SHALL support idempotent operations by external_key with dry-run preview showing row-level diffs and validation errors
4. WHEN handling picking policies THEN the system SHALL document FEFO for availability/picking and FIFO for cost valuation with override capabilities requiring user justification
5. WHEN processing API requests THEN the system SHALL maintain idempotent upserts, atomic transactions, and clear error responses with specific field-level validation messages
6. WHEN managing conflicts THEN the system SHALL provide explicit conflict strategies with user-friendly resolution options and maintain audit trails for all changes
