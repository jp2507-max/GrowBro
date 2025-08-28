-- Creates the cleanup_logs table used by the periodic cleanup job for idempotency keys
-- Ensure this migration is applied before enabling/scheduling the cleanup job

create table if not exists public.cleanup_logs (
  table_name text,
  deleted_count integer,
  failed_records_cleaned integer,
  cleanup_time timestamptz
);
