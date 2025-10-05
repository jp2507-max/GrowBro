-- Migration: Add RLS policies for playbook-related private user tables
-- This ensures per-user isolation for series, tasks, occurrence_overrides, and notification_queue
-- Community templates remain public-read as configured in previous migration

BEGIN;

-- Enable RLS on private user tables
ALTER TABLE public.series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.occurrence_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ph_ec_readings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SERIES TABLE RLS POLICIES
-- ============================================================================

-- Users can view their own series (via plant ownership)
-- Note: This assumes plants table has user_id column for ownership
CREATE POLICY "Users can view their own series"
  ON public.series
  FOR SELECT
  USING (
    plant_id IS NULL 
    OR EXISTS (
      SELECT 1 FROM public.plants 
      WHERE plants.id = series.plant_id 
      AND plants.user_id = auth.uid()
    )
  );

-- Users can insert their own series
CREATE POLICY "Users can insert their own series"
  ON public.series
  FOR INSERT
  WITH CHECK (
    plant_id IS NULL 
    OR EXISTS (
      SELECT 1 FROM public.plants 
      WHERE plants.id = series.plant_id 
      AND plants.user_id = auth.uid()
    )
  );

-- Users can update their own series
CREATE POLICY "Users can update their own series"
  ON public.series
  FOR UPDATE
  USING (
    plant_id IS NULL 
    OR EXISTS (
      SELECT 1 FROM public.plants 
      WHERE plants.id = series.plant_id 
      AND plants.user_id = auth.uid()
    )
  )
  WITH CHECK (
    plant_id IS NULL 
    OR EXISTS (
      SELECT 1 FROM public.plants 
      WHERE plants.id = series.plant_id 
      AND plants.user_id = auth.uid()
    )
  );

-- Users can delete their own series
CREATE POLICY "Users can delete their own series"
  ON public.series
  FOR DELETE
  USING (
    plant_id IS NULL 
    OR EXISTS (
      SELECT 1 FROM public.plants 
      WHERE plants.id = series.plant_id 
      AND plants.user_id = auth.uid()
    )
  );

-- ============================================================================
-- TASKS TABLE RLS POLICIES
-- ============================================================================

-- Users can view their own tasks (via plant ownership)
CREATE POLICY "Users can view their own tasks"
  ON public.tasks
  FOR SELECT
  USING (
    plant_id IS NULL 
    OR EXISTS (
      SELECT 1 FROM public.plants 
      WHERE plants.id = tasks.plant_id 
      AND plants.user_id = auth.uid()
    )
  );

-- Users can insert their own tasks
CREATE POLICY "Users can insert their own tasks"
  ON public.tasks
  FOR INSERT
  WITH CHECK (
    plant_id IS NULL 
    OR EXISTS (
      SELECT 1 FROM public.plants 
      WHERE plants.id = tasks.plant_id 
      AND plants.user_id = auth.uid()
    )
  );

-- Users can update their own tasks
CREATE POLICY "Users can update their own tasks"
  ON public.tasks
  FOR UPDATE
  USING (
    plant_id IS NULL 
    OR EXISTS (
      SELECT 1 FROM public.plants 
      WHERE plants.id = tasks.plant_id 
      AND plants.user_id = auth.uid()
    )
  )
  WITH CHECK (
    plant_id IS NULL 
    OR EXISTS (
      SELECT 1 FROM public.plants 
      WHERE plants.id = tasks.plant_id 
      AND plants.user_id = auth.uid()
    )
  );

-- Users can delete their own tasks
CREATE POLICY "Users can delete their own tasks"
  ON public.tasks
  FOR DELETE
  USING (
    plant_id IS NULL 
    OR EXISTS (
      SELECT 1 FROM public.plants 
      WHERE plants.id = tasks.plant_id 
      AND plants.user_id = auth.uid()
    )
  );

-- ============================================================================
-- OCCURRENCE_OVERRIDES TABLE RLS POLICIES
-- ============================================================================

-- Users can view their own occurrence overrides (via series ownership)
CREATE POLICY "Users can view their own occurrence overrides"
  ON public.occurrence_overrides
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.series 
      WHERE series.id = occurrence_overrides.series_id 
      AND (
        series.plant_id IS NULL 
        OR EXISTS (
          SELECT 1 FROM public.plants 
          WHERE plants.id = series.plant_id 
          AND plants.user_id = auth.uid()
        )
      )
    )
  );

-- Users can insert their own occurrence overrides
CREATE POLICY "Users can insert their own occurrence overrides"
  ON public.occurrence_overrides
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.series 
      WHERE series.id = occurrence_overrides.series_id 
      AND (
        series.plant_id IS NULL 
        OR EXISTS (
          SELECT 1 FROM public.plants 
          WHERE plants.id = series.plant_id 
          AND plants.user_id = auth.uid()
        )
      )
    )
  );

-- Users can update their own occurrence overrides
CREATE POLICY "Users can update their own occurrence overrides"
  ON public.occurrence_overrides
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.series 
      WHERE series.id = occurrence_overrides.series_id 
      AND (
        series.plant_id IS NULL 
        OR EXISTS (
          SELECT 1 FROM public.plants 
          WHERE plants.id = series.plant_id 
          AND plants.user_id = auth.uid()
        )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.series 
      WHERE series.id = occurrence_overrides.series_id 
      AND (
        series.plant_id IS NULL 
        OR EXISTS (
          SELECT 1 FROM public.plants 
          WHERE plants.id = series.plant_id 
          AND plants.user_id = auth.uid()
        )
      )
    )
  );

-- Users can delete their own occurrence overrides
CREATE POLICY "Users can delete their own occurrence overrides"
  ON public.occurrence_overrides
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.series 
      WHERE series.id = occurrence_overrides.series_id 
      AND (
        series.plant_id IS NULL 
        OR EXISTS (
          SELECT 1 FROM public.plants 
          WHERE plants.id = series.plant_id 
          AND plants.user_id = auth.uid()
        )
      )
    )
  );

-- ============================================================================
-- NOTIFICATION_QUEUE TABLE RLS POLICIES
-- ============================================================================

-- Users can view their own notification queue entries (via task ownership)
CREATE POLICY "Users can view their own notification queue"
  ON public.notification_queue
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks 
      WHERE tasks.id = notification_queue.task_id 
      AND (
        tasks.plant_id IS NULL 
        OR EXISTS (
          SELECT 1 FROM public.plants 
          WHERE plants.id = tasks.plant_id 
          AND plants.user_id = auth.uid()
        )
      )
    )
  );

-- Users can insert their own notification queue entries
CREATE POLICY "Users can insert their own notification queue"
  ON public.notification_queue
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tasks 
      WHERE tasks.id = notification_queue.task_id 
      AND (
        tasks.plant_id IS NULL 
        OR EXISTS (
          SELECT 1 FROM public.plants 
          WHERE plants.id = tasks.plant_id 
          AND plants.user_id = auth.uid()
        )
      )
    )
  );

-- Users can update their own notification queue entries
CREATE POLICY "Users can update their own notification queue"
  ON public.notification_queue
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks 
      WHERE tasks.id = notification_queue.task_id 
      AND (
        tasks.plant_id IS NULL 
        OR EXISTS (
          SELECT 1 FROM public.plants 
          WHERE plants.id = tasks.plant_id 
          AND plants.user_id = auth.uid()
        )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tasks 
      WHERE tasks.id = notification_queue.task_id 
      AND (
        tasks.plant_id IS NULL 
        OR EXISTS (
          SELECT 1 FROM public.plants 
          WHERE plants.id = tasks.plant_id 
          AND plants.user_id = auth.uid()
        )
      )
    )
  );

-- Users can delete their own notification queue entries
CREATE POLICY "Users can delete their own notification queue"
  ON public.notification_queue
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks 
      WHERE tasks.id = notification_queue.task_id 
      AND (
        tasks.plant_id IS NULL 
        OR EXISTS (
          SELECT 1 FROM public.plants 
          WHERE plants.id = tasks.plant_id 
          AND plants.user_id = auth.uid()
        )
      )
    )
  );

-- ============================================================================
-- PH_EC_READINGS TABLE RLS POLICIES
-- ============================================================================

-- Users can view their own pH/EC readings (via plant ownership)
CREATE POLICY "Users can view their own ph_ec_readings"
  ON public.ph_ec_readings
  FOR SELECT
  USING (
    plant_id IS NULL 
    OR EXISTS (
      SELECT 1 FROM public.plants 
      WHERE plants.id = ph_ec_readings.plant_id 
      AND plants.user_id = auth.uid()
    )
  );

-- Users can insert their own pH/EC readings
CREATE POLICY "Users can insert their own ph_ec_readings"
  ON public.ph_ec_readings
  FOR INSERT
  WITH CHECK (
    plant_id IS NULL 
    OR EXISTS (
      SELECT 1 FROM public.plants 
      WHERE plants.id = ph_ec_readings.plant_id 
      AND plants.user_id = auth.uid()
    )
  );

-- Users can update their own pH/EC readings
CREATE POLICY "Users can update their own ph_ec_readings"
  ON public.ph_ec_readings
  FOR UPDATE
  USING (
    plant_id IS NULL 
    OR EXISTS (
      SELECT 1 FROM public.plants 
      WHERE plants.id = ph_ec_readings.plant_id 
      AND plants.user_id = auth.uid()
    )
  )
  WITH CHECK (
    plant_id IS NULL 
    OR EXISTS (
      SELECT 1 FROM public.plants 
      WHERE plants.id = ph_ec_readings.plant_id 
      AND plants.user_id = auth.uid()
    )
  );

-- Users can delete their own pH/EC readings
CREATE POLICY "Users can delete their own ph_ec_readings"
  ON public.ph_ec_readings
  FOR DELETE
  USING (
    plant_id IS NULL 
    OR EXISTS (
      SELECT 1 FROM public.plants 
      WHERE plants.id = ph_ec_readings.plant_id 
      AND plants.user_id = auth.uid()
    )
  );

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.series TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.occurrence_overrides TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_queue TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ph_ec_readings TO authenticated;

COMMIT;

