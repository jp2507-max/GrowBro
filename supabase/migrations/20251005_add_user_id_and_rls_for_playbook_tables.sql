-- Migration: Add user_id columns and RLS policies for playbook-related tables
-- This ensures per-user isolation for series, tasks, occurrence_overrides, and notification_queue
-- Community templates remain public-read as configured in previous migration

BEGIN;

-- ============================================================================
-- ADD USER_ID COLUMNS TO PRIVATE TABLES
-- ============================================================================

-- Add user_id to series table
ALTER TABLE public.series ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add user_id to tasks table
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add user_id to occurrence_overrides table
ALTER TABLE public.occurrence_overrides ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add user_id to ph_ec_readings table (if not already present)
ALTER TABLE public.ph_ec_readings ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create indexes for efficient user-based queries
CREATE INDEX IF NOT EXISTS idx_series_user_id ON public.series(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON public.tasks(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_occurrence_overrides_user_id ON public.occurrence_overrides(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ph_ec_readings_user_id ON public.ph_ec_readings(user_id) WHERE deleted_at IS NULL;

-- ============================================================================
-- ENABLE RLS ON PRIVATE USER TABLES
-- ============================================================================

ALTER TABLE public.series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.occurrence_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ph_ec_readings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SERIES TABLE RLS POLICIES
-- ============================================================================

CREATE POLICY "Users can view their own series"
  ON public.series
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own series"
  ON public.series
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own series"
  ON public.series
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own series"
  ON public.series
  FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================================
-- TASKS TABLE RLS POLICIES
-- ============================================================================

CREATE POLICY "Users can view their own tasks"
  ON public.tasks
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own tasks"
  ON public.tasks
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own tasks"
  ON public.tasks
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own tasks"
  ON public.tasks
  FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================================
-- OCCURRENCE_OVERRIDES TABLE RLS POLICIES
-- ============================================================================

CREATE POLICY "Users can view their own occurrence overrides"
  ON public.occurrence_overrides
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own occurrence overrides"
  ON public.occurrence_overrides
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own occurrence overrides"
  ON public.occurrence_overrides
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own occurrence overrides"
  ON public.occurrence_overrides
  FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================================
-- NOTIFICATION_QUEUE TABLE RLS POLICIES
-- ============================================================================

-- Notification queue entries are linked to tasks via task_id
-- We need to join with tasks table to check user ownership
CREATE POLICY "Users can view their own notification queue"
  ON public.notification_queue
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks 
      WHERE tasks.id = notification_queue.task_id 
      AND tasks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own notification queue"
  ON public.notification_queue
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tasks 
      WHERE tasks.id = notification_queue.task_id 
      AND tasks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own notification queue"
  ON public.notification_queue
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks 
      WHERE tasks.id = notification_queue.task_id 
      AND tasks.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tasks 
      WHERE tasks.id = notification_queue.task_id 
      AND tasks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own notification queue"
  ON public.notification_queue
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks 
      WHERE tasks.id = notification_queue.task_id 
      AND tasks.user_id = auth.uid()
    )
  );

-- ============================================================================
-- PH_EC_READINGS TABLE RLS POLICIES
-- ============================================================================

CREATE POLICY "Users can view their own ph_ec_readings"
  ON public.ph_ec_readings
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own ph_ec_readings"
  ON public.ph_ec_readings
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own ph_ec_readings"
  ON public.ph_ec_readings
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own ph_ec_readings"
  ON public.ph_ec_readings
  FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.series TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.occurrence_overrides TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_queue TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ph_ec_readings TO authenticated;

COMMIT;

