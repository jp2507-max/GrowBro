-- DSR Jobs schema: tracks export/delete/withdraw requests with RLS and auditing
-- Requirements: 6.4 (DSR endpoints), 6.5 (cascade deletion), 2.3 (withdraw propagation), 5.6 (audit trails)

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- for gen_random_uuid()

-- Ensure privacy schema exists
CREATE SCHEMA IF NOT EXISTS privacy;

-- Job type enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dsr_job_type_enum') THEN
    CREATE TYPE dsr_job_type_enum AS ENUM ('export', 'delete', 'withdraw');
  END IF;
END $$;

-- Job status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dsr_job_status_enum') THEN
    CREATE TYPE dsr_job_status_enum AS ENUM ('queued', 'processing', 'completed', 'failed');
  END IF;
END $$;

-- Jobs table
CREATE TABLE IF NOT EXISTS privacy.dsr_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_type dsr_job_type_enum NOT NULL,
  status dsr_job_status_enum NOT NULL DEFAULT 'queued',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  estimated_completion TIMESTAMPTZ,
  result_location TEXT, -- URL or path for in-app download (no email)
  error_message TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb -- job-specific options, never store PII
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_dsr_jobs_user ON privacy.dsr_jobs (user_id);
CREATE INDEX IF NOT EXISTS idx_dsr_jobs_status ON privacy.dsr_jobs (status);
CREATE INDEX IF NOT EXISTS idx_dsr_jobs_type ON privacy.dsr_jobs (job_type);

-- RLS
ALTER TABLE privacy.dsr_jobs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to manage only their own jobs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'privacy' AND tablename = 'dsr_jobs' AND policyname = 'user_can_manage_own_dsr_jobs'
  ) THEN
    CREATE POLICY user_can_manage_own_dsr_jobs
      ON privacy.dsr_jobs
      FOR ALL
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Grants
GRANT USAGE ON SCHEMA privacy TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON privacy.dsr_jobs TO authenticated;

-- updated_at trigger
CREATE OR REPLACE FUNCTION privacy.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON privacy.dsr_jobs;
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON privacy.dsr_jobs
FOR EACH ROW EXECUTE FUNCTION privacy.set_updated_at();

COMMENT ON TABLE privacy.dsr_jobs IS 'Tracks DSR requests with job IDs and statuses (no PII in payload).';
COMMENT ON COLUMN privacy.dsr_jobs.result_location IS 'In-app download location for exports (avoid email).';

