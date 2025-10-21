-- Add unique index on statements_of_reasons.decision_id for upsert support
-- This enables PostgreSQL ON CONFLICT clause to work with decision_id
-- The column already has a UNIQUE constraint, but we need an explicit unique index for upsert operations

CREATE UNIQUE INDEX IF NOT EXISTS idx_statements_of_reasons_decision_id_unique
  ON public.statements_of_reasons (decision_id);
