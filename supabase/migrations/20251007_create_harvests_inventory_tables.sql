-- Migration: Create harvests and inventory tables for post-harvest workflow tracking
-- Date: 2025-10-07
-- Requirements: 11.1, 11.3, 11.5

-- ============================================================================
-- Table: harvests
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.harvests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  stage VARCHAR(20) NOT NULL CHECK (stage IN ('harvest', 'drying', 'curing', 'inventory')),
  
  -- Weight fields stored as integer grams (Requirement 11.1)
  wet_weight_g INTEGER CHECK (wet_weight_g >= 0 AND wet_weight_g <= 100000),
  dry_weight_g INTEGER CHECK (dry_weight_g >= 0 AND dry_weight_g <= 100000),
  trimmings_weight_g INTEGER CHECK (trimmings_weight_g >= 0 AND trimmings_weight_g <= 100000),
  
  notes TEXT DEFAULT '',
  
  -- Stage timing fields (server-authoritative UTC timestamps)
  stage_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  stage_completed_at TIMESTAMPTZ,
  
  -- Photo storage (file URIs as JSONB array)
  photos JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Standard audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  
  -- Sync fields for WatermelonDB integration
  server_revision BIGINT,
  server_updated_at_ms BIGINT,
  conflict_seen BOOLEAN DEFAULT false,
  
  -- Weight validation constraint (Requirement 11.3)
  CONSTRAINT valid_weights CHECK (
    (wet_weight_g IS NULL OR dry_weight_g IS NULL) OR
    (dry_weight_g <= wet_weight_g)
  )
);

-- Add comment for documentation
COMMENT ON TABLE public.harvests IS 'Post-harvest tracking through stages: harvest → drying → curing → inventory. Private per user, syncs via WatermelonDB.';

-- Foreign key constraints (note: plants table must exist)
-- ALTER TABLE public.harvests ADD CONSTRAINT harvests_plant_id_fkey FOREIGN KEY (plant_id) REFERENCES public.plants(id);
-- ALTER TABLE public.harvests ADD CONSTRAINT harvests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

-- ============================================================================
-- Indexes for harvests (Requirement 11.5)
-- ============================================================================

-- Primary sync query index: (user_id, updated_at) for efficient pull operations
CREATE INDEX IF NOT EXISTS idx_harvests_user_updated ON public.harvests(user_id, updated_at);

-- Plant filtering index
CREATE INDEX IF NOT EXISTS idx_harvests_plant ON public.harvests(plant_id);

-- Stage filtering index (excludes soft-deleted rows)
CREATE INDEX IF NOT EXISTS idx_harvests_stage ON public.harvests(stage) WHERE deleted_at IS NULL;

-- Partial unique index: only one "open" harvest per plant at a time
-- This prevents multiple harvests in 'harvest' stage for the same plant
CREATE UNIQUE INDEX IF NOT EXISTS ux_harvests_plant_open_harvest
  ON public.harvests(plant_id)
  WHERE deleted_at IS NULL AND stage = 'harvest';

-- ============================================================================
-- Table: inventory
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id UUID NOT NULL,
  harvest_id UUID NOT NULL,
  user_id UUID NOT NULL,
  
  -- Final weight must be provided (Requirement 11.1, 11.3)
  final_weight_g INTEGER NOT NULL CHECK (final_weight_g >= 0),
  
  harvest_date DATE NOT NULL,
  total_duration_days INTEGER NOT NULL CHECK (total_duration_days >= 0),
  
  -- Standard audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  
  -- Sync fields for WatermelonDB integration
  server_revision BIGINT,
  server_updated_at_ms BIGINT,
  
  -- Ensure one inventory record per harvest
  UNIQUE(harvest_id)
);

-- Add comment for documentation
COMMENT ON TABLE public.inventory IS 'Final inventory records created when curing stage completes. One record per harvest.';

-- Foreign key constraints (note: plants and harvests tables must exist)
-- ALTER TABLE public.inventory ADD CONSTRAINT inventory_plant_id_fkey FOREIGN KEY (plant_id) REFERENCES public.plants(id);
-- ALTER TABLE public.inventory ADD CONSTRAINT inventory_harvest_id_fkey FOREIGN KEY (harvest_id) REFERENCES public.harvests(id);
-- ALTER TABLE public.inventory ADD CONSTRAINT inventory_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

-- ============================================================================
-- Indexes for inventory (Requirement 11.5)
-- ============================================================================

-- Primary sync query index: (user_id, updated_at) for efficient pull operations
CREATE INDEX IF NOT EXISTS idx_inventory_user_updated ON public.inventory(user_id, updated_at);

-- Plant filtering index
CREATE INDEX IF NOT EXISTS idx_inventory_plant ON public.inventory(plant_id);

-- ============================================================================
-- Trigger: Auto-update updated_at timestamp
-- ============================================================================

-- Function to automatically set updated_at on UPDATE
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to harvests table
DROP TRIGGER IF EXISTS trigger_set_updated_at_harvests ON public.harvests;
CREATE TRIGGER trigger_set_updated_at_harvests
  BEFORE UPDATE ON public.harvests
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Apply trigger to inventory table
DROP TRIGGER IF EXISTS trigger_set_updated_at_inventory ON public.inventory;
CREATE TRIGGER trigger_set_updated_at_inventory
  BEFORE UPDATE ON public.inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on harvests table
ALTER TABLE public.harvests ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage their own harvests
DROP POLICY IF EXISTS "Users can manage their own harvests" ON public.harvests;
CREATE POLICY "Users can manage their own harvests" ON public.harvests
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Enable RLS on inventory table
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage their own inventory
DROP POLICY IF EXISTS "Users can manage their own inventory" ON public.inventory;
CREATE POLICY "Users can manage their own inventory" ON public.inventory
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- Grant permissions (authenticated users can access their own data)
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.harvests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory TO authenticated;
