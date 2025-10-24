-- Migration: Add user_id column to trusted_flaggers table
-- Fixes issue where isUserTrustedFlagger function always returned false
-- because the table schema didn't link trusted flagger records to user accounts
--
-- This migration adds a user_id column that references auth.users(id) to establish
-- the relationship between trusted flagger records and moderator accounts.

-- Add user_id column to trusted_flaggers table
ALTER TABLE public.trusted_flaggers
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add index for efficient lookups by user_id
CREATE INDEX IF NOT EXISTS idx_trusted_flaggers_user_id
ON public.trusted_flaggers (user_id) WHERE user_id IS NOT NULL;

-- Add comment to document the new column
COMMENT ON COLUMN public.trusted_flaggers.user_id IS 'References the moderator account that owns this trusted flagger record (auth.users.id)';
