-- Migration: Create moderation metrics table for observability and analytics
-- Implements: Persistent storage for moderation metrics tracking
--
-- Requirements: Analytics and observability for DSA compliance monitoring

CREATE TABLE IF NOT EXISTS public.moderation_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Metric identification
  metric_name TEXT NOT NULL,
  value NUMERIC NOT NULL,

  -- Timestamp
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Flexible metadata storage
  metadata JSONB DEFAULT '{}'::JSONB,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_moderation_metrics_name_timestamp
  ON public.moderation_metrics (metric_name, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_moderation_metrics_timestamp
  ON public.moderation_metrics (timestamp DESC);

-- RLS Policy: Only service role can insert, authenticated users can read for analytics
ALTER TABLE public.moderation_metrics ENABLE ROW LEVEL SECURITY;

-- Allow service role to insert metrics
CREATE POLICY "Service role can insert metrics" ON public.moderation_metrics
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Allow authenticated users to read metrics for analytics dashboards
CREATE POLICY "Authenticated users can read metrics" ON public.moderation_metrics
  FOR SELECT USING (auth.role() = 'authenticated');

-- Comments
COMMENT ON TABLE public.moderation_metrics IS 'Persistent storage for moderation system metrics and analytics data';
COMMENT ON COLUMN public.moderation_metrics.metric_name IS 'Name of the metric (e.g., appeal_decision, false_positive_rate)';
COMMENT ON COLUMN public.moderation_metrics.value IS 'Numeric value of the metric';
COMMENT ON COLUMN public.moderation_metrics.metadata IS 'Additional context data as JSON';</content>
<parameter name="filePath">c:\Users\Peter\GrowBro\supabase\migrations\20251025_create_moderation_metrics_table.sql