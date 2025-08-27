-- Migration: add moderation fields to posts
-- Adds nullable columns: deleted_at, hidden_at, moderation_reason
-- This migration must be applied before any indexes or policies that reference these columns.

-- Add soft-delete timestamp
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add moderation visibility timestamp
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ;

-- Add optional text reason for moderation actions
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS moderation_reason TEXT;

-- Add undo expiry timestamp (if not already present)
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS undo_expires_at TIMESTAMPTZ;

-- Optional: ensure indexes referencing these columns are created after this migration.
-- Example index (create in a follow-up migration or run after this migration):
-- CREATE INDEX IF NOT EXISTS idx_posts_visible ON posts (created_at DESC)
--   WHERE deleted_at IS NULL AND hidden_at IS NULL;

-- Note: Using IF NOT EXISTS makes this migration idempotent for safe re-runs in CI.
