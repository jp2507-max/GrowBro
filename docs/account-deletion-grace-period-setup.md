# Account Deletion Grace Period Setup Guide

This guide explains how to set up the scheduled job that processes expired account deletion requests after the 30-day grace period.

## Overview

GrowBro implements a 30-day grace period for account deletions (GDPR requirement 6.8). The `process-expired-deletions` Edge Function runs daily to permanently delete accounts whose grace period has expired.

## Components

### 1. Database Schema

- **Table**: `account_deletion_requests`
- **Migration**: `supabase/migrations/20251102_create_account_deletion_requests.sql`
- **Key columns**:
  - `request_id`: Unique identifier for tracking
  - `user_id`: FK to auth.users
  - `status`: 'pending' | 'cancelled' | 'completed'
  - `scheduled_for`: Deletion date (created_at + 30 days)
- **Helper functions**:
  - `check_pending_deletion(user_id)`: Returns pending request with days remaining
  - `process_expired_deletion_requests()`: Finds and processes expired requests

### 2. Edge Functions

#### delete-account

- **Path**: `supabase/functions/delete-account/index.ts`
- **Purpose**: Permanently deletes user account and all associated data
- **Triggered by**: User confirmation OR scheduled job
- **Security**: Requires valid JWT or service role key

#### process-expired-deletions

- **Path**: `supabase/functions/process-expired-deletions/index.ts`
- **Purpose**: Finds and processes expired deletion requests
- **Triggered by**: pg_cron scheduled job (daily at 2 AM)
- **Security**: Requires service role key
- **Returns**: Summary of processed/failed deletions

### 3. Frontend Components

#### RestoreAccountBanner

- **Path**: `src/components/settings/restore-account-banner.tsx`
- **Purpose**: Displays warning banner with days remaining
- **Features**: Cancel deletion button, dismissible, auto-shows on auth
- **Integration**: Rendered in `(app)/_layout.tsx`

#### usePendingDeletion Hook

- **Path**: `src/lib/hooks/use-pending-deletion.tsx`
- **Purpose**: Checks for pending deletion on auth state change
- **Returns**: `{ pendingDeletion, isLoading, hasPendingDeletion }`

### 4. API Hooks

- **useRequestAccountDeletion**: Creates deletion request with grace period
- **useCancelAccountDeletion**: Cancels pending deletion request
- **checkPendingDeletion**: Checks if user has pending deletion

## Setup Instructions

### 1. Apply Database Migration

Using Supabase MCP tools:

```bash
# Apply migration to create account_deletion_requests table
```

Or using Supabase CLI:

```bash
supabase db push
```

### 2. Deploy Edge Functions

Deploy both Edge Functions to Supabase:

```bash
# Deploy permanent deletion function
supabase functions deploy delete-account

# Deploy scheduled processing function
supabase functions deploy process-expired-deletions
```

### 3. Set Up pg_cron Job

Connect to your Supabase database and create a cron job:

```sql
-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;

-- Schedule daily job at 2 AM UTC
SELECT cron.schedule(
  'process-expired-deletions',
  '0 2 * * *', -- Run at 2 AM daily
  $$SELECT net.http_post(
    url:='https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-expired-deletions',
    headers:='{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY", "Content-Type": "application/json"}'::jsonb,
    body:='{}'::jsonb
  ) AS request_id;$$
);
```

**Important**: Replace:

- `YOUR_PROJECT_REF` with your Supabase project reference
- `YOUR_SERVICE_ROLE_KEY` with your Supabase service role key (from project settings)

### 4. Verify Cron Job Setup

Check that the cron job was created successfully:

```sql
SELECT * FROM cron.job WHERE jobname = 'process-expired-deletions';
```

View cron job execution history:

```sql
SELECT * FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'process-expired-deletions')
ORDER BY start_time DESC
LIMIT 10;
```

### 5. Test the Setup

#### Manual Testing

Trigger the Edge Function manually to test:

```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-expired-deletions \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

Expected response:

```json
{
  "success": true,
  "processed_count": 0,
  "failed_count": 0
}
```

#### Create Test Deletion Request

1. Sign in to the app
2. Navigate to Settings > Security > Delete Account
3. Complete the deletion flow
4. Check database:

```sql
SELECT * FROM account_deletion_requests WHERE status = 'pending';
```

#### Simulate Expired Request

For testing, temporarily modify the scheduled_for date:

```sql
-- Set scheduled_for to past date for testing
UPDATE account_deletion_requests
SET scheduled_for = NOW() - INTERVAL '1 day'
WHERE request_id = 'YOUR_REQUEST_ID';

-- Manually trigger the Edge Function
-- (Use curl command above)

-- Check that status changed to 'completed'
SELECT * FROM account_deletion_requests WHERE request_id = 'YOUR_REQUEST_ID';
```

## Monitoring

### Check Cron Job Status

```sql
-- View recent executions
SELECT
  jobname,
  start_time,
  end_time,
  status,
  return_message
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'process-expired-deletions')
ORDER BY start_time DESC
LIMIT 20;
```

### Check Pending Deletions

```sql
-- Count pending deletions
SELECT COUNT(*) FROM account_deletion_requests WHERE status = 'pending';

-- View upcoming deletions (next 7 days)
SELECT
  request_id,
  user_id,
  scheduled_for,
  EXTRACT(DAY FROM (scheduled_for - NOW())) as days_until_deletion
FROM account_deletion_requests
WHERE status = 'pending'
  AND scheduled_for <= NOW() + INTERVAL '7 days'
ORDER BY scheduled_for ASC;
```

### Check Audit Logs

```sql
-- View deletion events
SELECT * FROM audit_logs
WHERE event_type = 'account_deleted'
ORDER BY created_at DESC
LIMIT 50;
```

## Troubleshooting

### Cron Job Not Running

1. Check if pg_cron extension is enabled:

   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pg_cron';
   ```

2. Check if job exists:

   ```sql
   SELECT * FROM cron.job;
   ```

3. Check recent execution errors:
   ```sql
   SELECT * FROM cron.job_run_details
   WHERE status != 'succeeded'
   ORDER BY start_time DESC;
   ```

### Edge Function Errors

1. Check function logs in Supabase Dashboard:
   - Go to Edge Functions > process-expired-deletions > Logs

2. Test function manually with curl (see above)

3. Check service role key is correct and has proper permissions

### Deletions Not Processing

1. Check if requests are actually expired:

   ```sql
   SELECT * FROM account_deletion_requests
   WHERE status = 'pending'
     AND scheduled_for <= NOW();
   ```

2. Check audit logs for deletion attempts:

   ```sql
   SELECT * FROM audit_logs
   WHERE event_type = 'account_deletion_error'
   ORDER BY created_at DESC;
   ```

3. Manually trigger the Edge Function to see detailed error messages

## Security Considerations

1. **Service Role Key**: Keep the service role key secure. It's used in the cron job SQL and should only be stored in the database.

2. **Rate Limiting**: RLS policy on account_deletion_requests prevents users from creating multiple pending requests.

3. **Audit Trail**: All deletion events are logged to audit_logs table for compliance.

4. **Cancellation**: Users can cancel deletion anytime before scheduled_for date by:
   - Logging in (triggers restore banner)
   - Clicking "Cancel Deletion" button

## GDPR Compliance

This implementation satisfies:

- **Requirement 6.7**: Users can restore account during grace period
- **Requirement 6.8**: Permanent deletion after 30-day grace period
- **Requirement 6.9**: Clear notification of days remaining
- **Requirement 6.11**: Rate limiting (one pending request per user via RLS)

## Maintenance

### Updating the Schedule

To change the cron schedule:

```sql
-- Unschedule existing job
SELECT cron.unschedule('process-expired-deletions');

-- Create new schedule (e.g., every 6 hours)
SELECT cron.schedule(
  'process-expired-deletions',
  '0 */6 * * *', -- Every 6 hours
  $$...$$ -- Same SQL as before
);
```

### Cleaning Up Old Records

Periodically clean up completed deletion requests:

```sql
-- Delete completed requests older than 90 days
DELETE FROM account_deletion_requests
WHERE status = 'completed'
  AND updated_at < NOW() - INTERVAL '90 days';
```
