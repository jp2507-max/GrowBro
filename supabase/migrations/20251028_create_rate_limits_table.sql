-- Migration: Create rate_limits table for per-user rate limiting
-- Description: Stores rate limit counters with TTL for API endpoints
-- Requirements: Security audit rate limiting (10 assessments/hr, 50 tasks/hr, 5 posts/hr)

BEGIN;

-- Rate limits table with automatic TTL cleanup
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  counter INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Unique constraint per user per endpoint per window
  CONSTRAINT ux_rate_limits_user_endpoint_window UNIQUE (user_id, endpoint, window_start)
);

-- Index for efficient lookups and cleanup
CREATE INDEX idx_rate_limits_user_endpoint ON public.rate_limits (user_id, endpoint);
CREATE INDEX idx_rate_limits_expires_at ON public.rate_limits (expires_at);

-- Enable Row Level Security
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only service role can access rate limits (internal use only)
CREATE POLICY "Service role can manage rate limits" ON public.rate_limits
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Function to atomically increment rate limit counter
CREATE OR REPLACE FUNCTION public.increment_rate_limit(
  p_user_id UUID,
  p_endpoint TEXT,
  p_limit INTEGER,
  p_window_seconds INTEGER,
  p_increment INTEGER DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_count INTEGER;
  v_window_start TIMESTAMPTZ;
  v_expires_at TIMESTAMPTZ;
  v_retry_after INTEGER;
BEGIN
  -- Calculate window boundaries
  v_window_start := date_trunc('hour', now());
  v_expires_at := v_window_start + (p_window_seconds || ' seconds')::INTERVAL;
  
  -- Try to insert or update atomically
  INSERT INTO public.rate_limits (user_id, endpoint, counter, window_start, expires_at)
  VALUES (p_user_id, p_endpoint, p_increment, v_window_start, v_expires_at)
  ON CONFLICT (user_id, endpoint, window_start)
  DO UPDATE SET
    counter = rate_limits.counter + p_increment,
    updated_at = now()
  RETURNING counter INTO v_current_count;
  
  -- Check if limit exceeded
  IF v_current_count > p_limit THEN
    -- Calculate retry-after in seconds
    v_retry_after := EXTRACT(EPOCH FROM (v_expires_at - now()))::INTEGER;
    
    RETURN jsonb_build_object(
      'allowed', false,
      'current', v_current_count,
      'limit', p_limit,
      'retryAfter', GREATEST(v_retry_after, 0)
    );
  END IF;
  
  RETURN jsonb_build_object(
    'allowed', true,
    'current', v_current_count,
    'limit', p_limit,
    'retryAfter', 0
  );
END;
$$;

-- Function to clean up expired rate limit entries
CREATE OR REPLACE FUNCTION public.cleanup_expired_rate_limits()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM public.rate_limits
  WHERE expires_at < now();
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;

-- Trigger to maintain updated_at
CREATE TRIGGER trg_rate_limits_updated_at
  BEFORE UPDATE ON public.rate_limits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Add comments for documentation
COMMENT ON TABLE public.rate_limits IS 'Per-user rate limiting counters with automatic TTL';
COMMENT ON COLUMN public.rate_limits.user_id IS 'User being rate limited';
COMMENT ON COLUMN public.rate_limits.endpoint IS 'API endpoint identifier (e.g., assessments, tasks, posts)';
COMMENT ON COLUMN public.rate_limits.counter IS 'Number of requests in current window';
COMMENT ON COLUMN public.rate_limits.window_start IS 'Start of the rate limit window (hourly)';
COMMENT ON COLUMN public.rate_limits.expires_at IS 'When this rate limit entry expires';
COMMENT ON FUNCTION public.increment_rate_limit IS 'Atomically increment rate limit counter and check threshold';
COMMENT ON FUNCTION public.cleanup_expired_rate_limits IS 'Remove expired rate limit entries (run periodically)';

COMMIT;
