-- Migration: add outbox table for scheduling OS notifications from DB-driven actions
-- This table stores notification actions (schedule/cancel) created in the same
-- DB transaction that updates task state. A separate worker reads and processes
-- these entries to schedule OS notifications. Entries are idempotent and track
-- attempts, backoff, and expiry to avoid drift.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS outbox_notification_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz NULL,
  attempted_count int NOT NULL DEFAULT 0 CHECK (attempted_count >= 0),
  next_attempt_at timestamptz NULL,
  expires_at timestamptz NULL,
  -- type: 'schedule' | 'cancel' etc
  action_type text NOT NULL CHECK (action_type IN ('schedule','cancel','update','delete')),
  -- JSON payload contains all context needed for the worker to perform action
  payload jsonb NOT NULL,
  -- status: 'pending' | 'in_progress' | 'processed' | 'failed' | 'expired'
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','processed','failed','expired')),
  -- optional business key to enforce idempotency at insertion time (e.g. task_id + notification_id)
  business_key text NULL
);

-- Index to quickly select pending entries ordered by next_attempt_at
CREATE INDEX IF NOT EXISTS idx_outbox_notification_actions_pending
  ON outbox_notification_actions (status, next_attempt_at, created_at);

-- Unique index on business_key to prevent duplicate scheduling actions when provided
CREATE UNIQUE INDEX IF NOT EXISTS ux_outbox_notification_actions_business_key
  ON outbox_notification_actions (business_key)
  WHERE business_key IS NOT NULL;

COMMIT;
