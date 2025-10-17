# Inventory & Consumables User Guide

## Overview

The Inventory & Consumables feature helps you track cultivation supplies, nutrients, seeds, containers, and other consumable items. The system automatically deducts inventory when you complete tasks, tracks costs using FIFO valuation, and forecasts when you'll need to reorder supplies.

## Key Concepts

### FEFO vs FIFO

- **FEFO (First-Expire-First-Out)**: Used for picking batches. The system automatically consumes batches expiring soonest first to minimize waste.
- **FIFO (First-In-First-Out)**: Used for cost accounting. Costs are calculated from the oldest batch costs at time of consumption.

### Tracking Modes

- **Simple**: Track total quantity only (e.g., tools, equipment)
- **Batched**: Track individual batches with lot numbers and expiry dates (e.g., nutrients, seeds)

## Getting Started

### Adding Your First Item

1. Tap the **"+"** button in the inventory tab
2. Fill in required fields:
   - **Item Name**: e.g., "Nutrient Solution A"
   - **Category**: Select from Nutrients, Seeds, Growing Media, Tools, Containers, Amendments
   - **Unit of Measure**: Use SI units where possible (ml, g, units)
   - **Tracking Mode**: Choose Simple or Batched
   - **Min Stock**: Threshold for low-stock alerts
   - **Reorder Multiple**: Pack size for ordering (e.g., bottles of 1000ml)

3. Tap **"Save"** to create the item

### Adding Stock (Batches)

For batched items, you'll need to add stock batches:

1. Open the item detail screen
2. Tap **"Add Batch"**
3. Enter batch details:
   - **Lot Number**: Unique identifier from packaging
   - **Quantity**: Amount in this batch
   - **Cost Per Unit**: Purchase price per unit (stored in cents to avoid rounding errors)
   - **Expiry Date** (optional): When this batch expires
   - **Received Date**: When you received this batch

4. Tap **"Save"** to add the batch

## Daily Use

### Automatic Deductions

The system automatically deducts inventory when you complete tasks:

#### Feeding Tasks

When you complete a feeding task with nutrients configured in the task template, the system:

- Deducts the specified amount from inventory
- Uses FEFO to pick from batches expiring soonest
- Scales quantities by plant count if configured
- Creates immutable movement records linked to the task

#### Harvest Tasks

When you complete a harvest task with consumables configured:

- Deducts containers, labels, etc. from inventory
- Records costs from the specific batches used
- Links movements to the harvest task for cost tracking

### Manual Stock Adjustments

To manually adjust stock:

1. Open the item detail screen
2. Tap **"Adjust Stock"**
3. Enter the adjustment quantity (positive to add, negative to remove)
4. Provide a reason (required for audit trail)
5. Tap **"Save"**

### Viewing Consumption History

To see where your inventory went:

1. Open the item detail screen
2. Tap **"View History"**
3. Filter by:
   - **Date Range**: Last 7/30/90/365 days or custom range
   - **Task**: See deductions from specific tasks
   - **Type**: Consumption vs manual adjustments

## CSV Import/Export

### Exporting Data

1. Tap the **"⋮"** menu in the inventory tab
2. Select **"Export to CSV"**
3. Three files are generated:
   - `items.csv`: Item master data
   - `batches.csv`: Stock batches
   - `movements.csv`: Transaction history

4. Files use RFC 4180 format with UTF-8 encoding

### Importing Data

1. Tap the **"⋮"** menu in the inventory tab
2. Select **"Import from CSV"**
3. Choose your CSV file (max 50,000 rows or 10MB)
4. Review the dry-run preview:
   - Green: Items to be added
   - Yellow: Items to be updated
   - Red: Validation errors

5. Fix any errors inline
6. Tap **"Confirm Import"** to apply changes

**Idempotency**: Re-importing the same file multiple times is safe - only new changes are applied.

### CSV Format

#### items.csv

```csv
external_key,name,category,unit,tracking_mode,min_stock,reorder_multiple,lead_time_days,sku
NUTRIENT-A,Nutrient Solution A,Nutrients,ml,batched,500,1000,7,SKU-001
SEEDS-AUTO,Autoflower Seeds,Seeds,units,batched,10,25,14,SKU-002
```

#### batches.csv

```csv
external_key,item_external_key,lot,expires_on,qty,cost_per_unit_minor,received_at
BATCH-001,NUTRIENT-A,LOT-2025-01,2026-12-31,1000,50,2025-01-15
BATCH-002,SEEDS-AUTO,SEED-LOT-A,2027-06-30,50,1500,2025-01-20
```

#### movements.csv

```csv
external_key,item_external_key,batch_lot,type,qty_delta,reason,task_external_id,created_at
MOV-001,NUTRIENT-A,LOT-2025-01,consumption,-100,Weekly feeding,TASK-001,2025-01-22T10:30:00Z
```

## Low Stock Monitoring

### Setting Up Alerts

1. Open the item detail screen
2. Set **"Min Stock"** to your reorder threshold
3. Set **"Lead Time Days"** to how long it takes to get new stock
4. Set **"Reorder Multiple"** to your typical order quantity

### Understanding Forecasts

The system calculates when you'll run out using:

- **8-week Simple Moving Average (SMA)**: Default for all items
- **Simple Exponential Smoothing (SES)**: Automatically upgrades when 12+ weeks of data available
- **80% Prediction Interval**: Shows range of likely stockout dates

### Responding to Low Stock Alerts

When an item shows low stock:

1. Check the **"Days to Zero"** forecast
2. Subtract lead time to get reorder-by date
3. Order in multiples of "Reorder Multiple" for best pricing
4. Add new batch when stock arrives

## Advanced Features

### Expired Batch Handling

By default, expired batches are excluded from automatic picking (FEFO). To use an expired batch:

1. Tap on the expired batch in the item detail screen
2. You'll see: "Expired on <date>. Excluded from auto-picking (FEFO). Override?"
3. Tap **"Use Anyway"**
4. Provide a justification reason
5. The system will allow manual consumption with your reason logged

### Cost Tracking

View costs per harvest:

1. Open a completed harvest task
2. Tap **"View Costs"**
3. See breakdown by item category:
   - Nutrients
   - Growing Media
   - Containers
   - Other supplies

4. Costs use FIFO valuation from batch costs at time of consumption

### Multi-Plant Scaling

For feeding tasks with multiple plants:

1. Configure task template with `perPlantQuantity` instead of `perTaskQuantity`
2. When completing the task, the system multiplies by plant count
3. Example: 50ml per plant × 5 plants = 250ml deducted

## Troubleshooting

### "Insufficient Stock" Error

**Cause**: Not enough inventory available to complete task

**Solution Options**:

1. **Partial Complete**: Consume what's available, log shortage
2. **Skip Deduction**: Complete task without deducting inventory
3. **Adjust Inventory**: Add stock now and retry

### Duplicate Deductions

**Prevention**: The system uses idempotency keys to prevent double-deductions on retries. Same task ID + timestamp = single deduction even if submitted multiple times.

### Sync Conflicts

**Resolution**: Last-Write-Wins (LWW) based on server timestamps

When you see "Your change overwritten by device X at <timestamp>":

1. Tap **"Reapply My Change"** to create a new server write with your data
2. Or accept the remote change and move on

### CSV Import Errors

Common validation errors:

- **Missing required fields**: Ensure name, category, unit, tracking_mode present
- **Invalid external_key**: Must be unique and non-empty
- **Invalid dates**: Use ISO-8601 format (YYYY-MM-DD)
- **Invalid numbers**: Use dot decimals (50.5, not 50,5)

## Offline Mode

All core functionality works offline:

- ✅ Add/edit items and batches
- ✅ Adjust stock manually
- ✅ Automatic deductions on task completion
- ✅ View consumption history
- ✅ Browse and search inventory

Limitations:

- ❌ CSV import/export requires network
- ❌ Sync conflicts resolved on reconnection

Changes sync automatically when network returns.

## Best Practices

1. **Use External Keys**: Add `external_key` to items for reliable CSV import/export
2. **Batch Everything Perishable**: Use batched tracking for anything with expiry dates
3. **Regular Stock Takes**: Verify physical counts match app quarterly
4. **Consistent Units**: Pick SI units (ml, g, cm) for easier calculations
5. **Meaningful Lot Numbers**: Use supplier lot numbers for traceability
6. **Set Realistic Min Stock**: Base on consumption rate + lead time + safety buffer

## Permission Requirements (Android 13+)

### Exact Alarm Permission

For low-stock notifications on Android 13+:

1. Go to **Settings** → **Inventory** → **Notifications**
2. Tap **"Enable Exact Alarms"**
3. System will prompt for SCHEDULE_EXACT_ALARM permission
4. Grant permission for accurate notification timing

**Fallback**: If denied, app uses inexact alarms with in-app banners for low stock.

## Support

For issues or questions:

- Check this guide first
- Review error messages for specific guidance
- Contact support with error logs if needed

---

**Version**: 1.0  
**Last Updated**: October 2025
