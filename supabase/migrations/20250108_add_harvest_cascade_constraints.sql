-- Add CASCADE deletion constraints to harvest tables for user account deletion
-- Requirements: 18.2 (owner isolation), implicit deletion cascade on account removal
-- Ensures harvest and inventory data is automatically deleted when user account is deleted

-- ============================================================================
-- Harvests table: Add CASCADE constraint for user_id
-- ============================================================================

-- Drop existing foreign key constraint if it exists (commented out in original migration)
-- and recreate with CASCADE delete
ALTER TABLE public.harvests
  DROP CONSTRAINT IF EXISTS harvests_user_id_fkey;

ALTER TABLE public.harvests
  ADD CONSTRAINT harvests_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

COMMENT ON CONSTRAINT harvests_user_id_fkey ON public.harvests IS
  'Cascade delete harvests when user account is deleted (Requirement 18.2)';

-- ============================================================================
-- Inventory table: Add CASCADE constraint for user_id
-- ============================================================================

-- Drop existing foreign key constraint if it exists (commented out in original migration)
-- and recreate with CASCADE delete
ALTER TABLE public.inventory
  DROP CONSTRAINT IF EXISTS inventory_user_id_fkey;

ALTER TABLE public.inventory
  ADD CONSTRAINT inventory_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

COMMENT ON CONSTRAINT inventory_user_id_fkey ON public.inventory IS
  'Cascade delete inventory when user account is deleted (Requirement 18.2)';

-- ============================================================================
-- Harvest Audits table: Add CASCADE constraint if table exists
-- ============================================================================

-- Check if harvest_audits table exists and add constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'harvest_audits'
  ) THEN
    -- Drop existing constraint if it exists
    ALTER TABLE public.harvest_audits
      DROP CONSTRAINT IF EXISTS harvest_audits_user_id_fkey;

    -- Add CASCADE constraint
    ALTER TABLE public.harvest_audits
      ADD CONSTRAINT harvest_audits_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES auth.users(id)
      ON DELETE CASCADE;

    COMMENT ON CONSTRAINT harvest_audits_user_id_fkey ON public.harvest_audits IS
      'Cascade delete harvest audits when user account is deleted (Requirement 18.2)';
  END IF;
END $$;

-- ============================================================================
-- Verification query (for manual testing, does not affect migration)
-- ============================================================================

-- SELECT
--   conname AS constraint_name,
--   conrelid::regclass AS table_name,
--   confdeltype AS delete_action,
--   pg_get_constraintdef(oid) AS constraint_definition
-- FROM pg_constraint
-- WHERE conrelid::regclass::text IN ('harvests', 'inventory', 'harvest_audits')
--   AND contype = 'f'
--   AND confrelid::regclass::text = 'users';

