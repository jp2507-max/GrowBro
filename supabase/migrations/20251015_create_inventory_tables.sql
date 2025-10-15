-- Inventory Items Table
CREATE TABLE inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  server_revision BIGINT,
  server_updated_at_ms BIGINT,

  CONSTRAINT positive_min_stock CHECK (min_stock >= 0),
  CONSTRAINT positive_reorder_multiple CHECK (reorder_multiple > 0)
);

COMMENT ON TABLE inventory_items IS 'Consumable inventory items (nutrients, seeds, supplies). Private per user, syncs via WatermelonDB.';

-- Inventory Batches Table
CREATE TABLE inventory_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  lot_number TEXT NOT NULL,
  expires_on DATE,
  quantity DECIMAL(10,3) NOT NULL,
  cost_per_unit_minor INTEGER NOT NULL,
  received_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  server_revision BIGINT,
  server_updated_at_ms BIGINT,

  CONSTRAINT positive_quantity CHECK (quantity >= 0),
  CONSTRAINT positive_cost CHECK (cost_per_unit_minor >= 0)
);

COMMENT ON TABLE inventory_batches IS 'Inventory batches with lot tracking and expiration dates. FEFO for picking, FIFO for costing.';
COMMENT ON COLUMN inventory_batches.cost_per_unit_minor IS 'Cost stored in minor units (cents) to avoid float drift';

-- Inventory Movements Table
CREATE TABLE inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES inventory_items(id),
  batch_id UUID REFERENCES inventory_batches(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('receipt', 'consumption', 'adjustment')),
  quantity_delta DECIMAL(10,3) NOT NULL,
  cost_per_unit_minor INTEGER,
  reason TEXT NOT NULL,
  task_id UUID,
  external_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

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

COMMENT ON TABLE inventory_movements IS 'Immutable inventory movement journal. All inventory changes are recorded as append-only movements for audit trails.';
COMMENT ON COLUMN inventory_movements.external_key IS 'Idempotency key for preventing duplicate movements';
COMMENT ON COLUMN inventory_movements.cost_per_unit_minor IS 'Cost in minor units (cents); can be null for adjustments only';

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

-- Composite indexes matching common filter patterns (equality predicate first)
CREATE INDEX idx_items_user_category ON inventory_items(user_id, category) WHERE deleted_at IS NULL;
CREATE INDEX idx_items_user_id ON inventory_items(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_items_updated ON inventory_items(user_id, updated_at) WHERE deleted_at IS NULL;

CREATE INDEX idx_batches_item_expire ON inventory_batches(item_id, expires_on) WHERE deleted_at IS NULL;
CREATE INDEX idx_batches_item_id ON inventory_batches(item_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_batches_updated ON inventory_batches(item_id, updated_at) WHERE deleted_at IS NULL;

CREATE INDEX idx_movements_item_id ON inventory_movements(item_id);
CREATE INDEX idx_movements_created_at ON inventory_movements(created_at);
CREATE INDEX idx_movements_task_id ON inventory_movements(task_id) WHERE task_id IS NOT NULL;
CREATE INDEX idx_movements_external_key ON inventory_movements(external_key) WHERE external_key IS NOT NULL;

-- Partial unique indexes for soft deletes
CREATE UNIQUE INDEX uq_batches_item_lot_active
  ON inventory_batches(item_id, lot_number)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX uq_movements_external_key_active
  ON inventory_movements(external_key)
  WHERE external_key IS NOT NULL;

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

-- Inventory Movements (Note: No UPDATE or DELETE policies - movements are immutable)
CREATE POLICY "movements_select" ON inventory_movements
  FOR SELECT USING (
    item_id IN (SELECT id FROM inventory_items WHERE user_id = auth.uid())
  );

CREATE POLICY "movements_insert" ON inventory_movements
  FOR INSERT WITH CHECK (
    item_id IN (SELECT id FROM inventory_items WHERE user_id = auth.uid())
  );
