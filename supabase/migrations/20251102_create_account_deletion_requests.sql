-- Create account_deletion_requests table for GDPR-compliant account deletion with grace period
-- Requirements: 6.5, 6.7, 6.8, 6.9, 6.11, 6.12

CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'cancelled', 'completed')),
  reason TEXT,
  policy_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_user_id ON public.account_deletion_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_request_id ON public.account_deletion_requests(request_id);
CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_status ON public.account_deletion_requests(status);
CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_scheduled_for ON public.account_deletion_requests(scheduled_for);

-- Create composite index for rate limiting queries
CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_user_status ON public.account_deletion_requests(user_id, status);

-- Enable Row Level Security
ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only view their own deletion requests
CREATE POLICY "Users can view own deletion requests"
  ON public.account_deletion_requests
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Users can only create one pending deletion request at a time (rate limiting)
-- Requirement: 6.11 - Rate limiting for deletion requests
CREATE POLICY "Users can create deletion request if no pending request exists"
  ON public.account_deletion_requests
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND NOT EXISTS (
      SELECT 1 
      FROM public.account_deletion_requests 
      WHERE user_id = auth.uid() 
      AND status = 'pending'
    )
  );

-- RLS Policy: Users can update their own deletion requests (for cancellation)
CREATE POLICY "Users can cancel own deletion requests"
  ON public.account_deletion_requests
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND status = 'cancelled');

-- RLS Policy: Service role can perform all operations (for scheduled deletion processing)
CREATE POLICY "Service role full access"
  ON public.account_deletion_requests
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_account_deletion_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at on row updates
CREATE TRIGGER update_account_deletion_requests_updated_at_trigger
  BEFORE UPDATE ON public.account_deletion_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_account_deletion_requests_updated_at();

-- Create function to check for pending deletion requests (used by restore flow)
-- Requirement: 6.7, 6.9 - Grace period restore flow
CREATE OR REPLACE FUNCTION check_pending_deletion(p_user_id UUID)
RETURNS TABLE (
  request_id UUID,
  scheduled_for TIMESTAMPTZ,
  requested_at TIMESTAMPTZ,
  days_remaining INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    adr.request_id,
    adr.scheduled_for,
    adr.requested_at,
    GREATEST(0, EXTRACT(DAY FROM (adr.scheduled_for - NOW()))::INTEGER) as days_remaining
  FROM public.account_deletion_requests adr
  WHERE adr.user_id = p_user_id
    AND adr.status = 'pending'
    AND adr.scheduled_for > NOW()
  ORDER BY adr.requested_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION check_pending_deletion(UUID) TO authenticated;

-- Create function to process expired deletion requests (called by scheduled job)
-- Requirement: 6.8 - Permanent deletion after grace period
CREATE OR REPLACE FUNCTION process_expired_deletion_requests()
RETURNS TABLE (
  processed_count INTEGER,
  failed_count INTEGER
) AS $$
DECLARE
  v_processed_count INTEGER := 0;
  v_failed_count INTEGER := 0;
  v_request RECORD;
BEGIN
  -- Find all pending deletion requests that have expired
  FOR v_request IN
    SELECT 
      adr.request_id,
      adr.user_id,
      adr.scheduled_for
    FROM public.account_deletion_requests adr
    WHERE adr.status = 'pending'
      AND adr.scheduled_for <= NOW()
    ORDER BY adr.scheduled_for ASC
    FOR UPDATE SKIP LOCKED -- Prevent concurrent processing
  LOOP
    BEGIN
      -- Mark as completed before deletion to prevent reprocessing
      UPDATE public.account_deletion_requests
      SET status = 'completed'
      WHERE request_id = v_request.request_id;

      -- Log completion to audit log
      INSERT INTO public.audit_logs (
        user_id,
        event_type,
        payload,
        created_at
      ) VALUES (
        v_request.user_id,
        'account_deleted',
        jsonb_build_object(
          'request_id', v_request.request_id,
          'scheduled_for', v_request.scheduled_for,
          'deleted_at', NOW()
        ),
        NOW()
      );

      -- The actual user deletion will be handled by the delete-account Edge Function
      -- or by auth.users ON DELETE CASCADE policies
      -- This function just marks the request as completed

      v_processed_count := v_processed_count + 1;

      RAISE NOTICE 'Processed deletion request % for user %', v_request.request_id, v_request.user_id;

    EXCEPTION WHEN OTHERS THEN
      v_failed_count := v_failed_count + 1;
      RAISE WARNING 'Failed to process deletion request %: %', v_request.request_id, SQLERRM;
    END;
  END LOOP;

  RETURN QUERY SELECT v_processed_count, v_failed_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to service role only
GRANT EXECUTE ON FUNCTION process_expired_deletion_requests() TO service_role;

-- Add comment to table
COMMENT ON TABLE public.account_deletion_requests IS 'Stores account deletion requests with 30-day grace period. Requirement: 6.5, 6.7, 6.8, 6.9, 6.11, 6.12';

-- Add comments to columns
COMMENT ON COLUMN public.account_deletion_requests.request_id IS 'Unique identifier for the deletion request, used for audit trails';
COMMENT ON COLUMN public.account_deletion_requests.scheduled_for IS 'Timestamp when the account will be permanently deleted (30 days from request)';
COMMENT ON COLUMN public.account_deletion_requests.status IS 'pending: awaiting grace period expiry, cancelled: user restored account, completed: deletion executed';
COMMENT ON COLUMN public.account_deletion_requests.policy_version IS 'Version of privacy policy at time of deletion request';
