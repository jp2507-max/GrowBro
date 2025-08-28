# Supabase Integration Guidelines

## Overview

GrowBro uses Supabase as the backend service for authentication, database operations, real-time features, and storage.

## Architecture

- **MCP Tools**: Use Supabase MCP tools for database migrations, schema management, and backend operations
- **Client Library**: `@supabase/supabase-js` configured in `src/lib/supabase.ts` for app-side operations
- **Environment**: Variables managed through `env.js` system with validation

## Database Operations

### Use MCP Tools For:

- Creating and managing database tables
- Running migrations and schema changes
- Managing RLS policies
- Backend administration tasks
- Generating TypeScript types

### Use Supabase Client For:

- Authentication flows (login, signup, session management)
- Real-time subscriptions for community features
- Direct database queries from the app
- File uploads to Supabase Storage

## Configuration

```typescript
// Client is configured with:
- AsyncStorage for session persistence
- Auto token refresh enabled
- URL polyfill for React Native compatibility
- Environment variable validation
```

## Security Guidelines

- Always use RLS (Row Level Security) policies
- Never use service key in client-side code
- Use `auth.getUser()` for user identification in Edge Functions
- Implement owner-only access patterns for user data

## Best Practices

- Use React Query for server state management with Supabase
- Implement optimistic updates for better UX
- Handle offline scenarios gracefully
- Use proper TypeScript types (generate with MCP tools)
- Follow the offline-first architecture with WatermelonDB sync

## Migrations and Scheduled Jobs

- Ensure migrations run before enabling any scheduled jobs that depend on schema.
- For idempotency cleanup: the `cleanup_logs` table is created via migration (see `supabase/migrations/20250828_create_cleanup_logs_table.sql`). The scheduled function must not perform DDL; it only inserts into `cleanup_logs`.
- Deployment order:
  1. Apply migrations.
  2. Deploy the cleanup implementation (Edge Function or DB function).
  3. Enable/schedule the job.

Note on scheduler choice

- Preferred (recommended): Supabase Scheduler invoking an Edge Function

  - Rationale: hosted Supabase projects often don't expose superuser extensions like `pg_cron`. Using an Edge Function keeps cleanup logic in application code, runs with the Supabase Scheduler (cron-like triggers), and uses `auth.getUser()` / service role safely when needed.
  - Implementation: create an Edge Function under `supabase/functions/cleanup_expired_idempotency_keys` (e.g. `supabase/functions/cleanup_expired_idempotency_keys/index.ts`) which connects to the database (using a short-lived service role or admin context provided by the Edge runtime) and executes the cleanup SQL (only DML, no DDL).
  - Schedule: configure Supabase Scheduler to call the Edge Function every 6 hours (or your desired cadence). Example description: "Run cleanup_expired_idempotency_keys every 6 hours to remove expired idempotency keys and log stats to `cleanup_logs`."

- Alternative: pg_cron (database-side scheduled job)

  - Rationale: If you control the Postgres instance and can install extensions, `pg_cron` runs directly inside the database and avoids an external Edge Function. This requires the `pg_cron` extension and appropriate privileges.
  - Where to place SQL: keep the function definition in your migrations (e.g. `supabase/migrations/` or a dedicated SQL file such as `supabase/functions/sql/cleanup_expired_idempotency_keys.sql`) so it is versioned and applied with other schema changes.
  - Security: when creating a database-side function that performs cleanup across all users, create it with `SECURITY DEFINER` and ensure the definer is a role with only the necessary privileges (avoid using the DB superuser in production where possible). Also explicitly set the search_path or fully-qualify table names to avoid search_path surprises.

  Example pg_cron-compatible function + schedule (create as a migration):

  ```sql
  -- define a cleanup function that runs as the definer
  CREATE OR REPLACE FUNCTION public.cleanup_expired_idempotency_keys()
  RETURNS void AS $$
  DECLARE
    deleted_count integer := 0;
    failed_count integer := 0;
  BEGIN
    -- Count failed records before deletion for monitoring
    SELECT COUNT(*) INTO failed_count
    FROM public.idempotency_keys
    WHERE expires_at < now()
      AND status = 'failed'
      AND error_details IS NOT NULL;

    DELETE FROM public.idempotency_keys
    WHERE expires_at < now()
      AND status IN ('completed', 'failed');

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    INSERT INTO public.cleanup_logs (table_name, deleted_count, failed_records_cleaned, cleanup_time)
    VALUES ('idempotency_keys', deleted_count, failed_count, now());
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;

  -- schedule with pg_cron (every 6 hours)
  -- requires CREATE EXTENSION IF NOT EXISTS pg_cron; run as a privileged migration
  SELECT cron.schedule('cleanup_idempotency_keys_every_6h', '0 */6 * * *', $$SELECT public.cleanup_expired_idempotency_keys();$$);
  ```

  Notes:

  - The `cron.schedule` call registers the job with pg_cron; adjust the cron expression if you want a different cadence (the example uses the top of every 6th hour).
  - Because this uses `SECURITY DEFINER`, be careful to set the function owner/definer to a restricted role that has only the privileges needed to delete and insert into the relevant tables.

If your repository does not yet include `supabase/functions/cleanup_expired_idempotency_keys`, the cleanup implementation referenced in the idempotency spec currently exists as a SQL example in `.kiro/specs/5. community-feed-improvements/idempotency-implementation.md` (see the `CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_keys()` snippet). Implement the final version either as an Edge Function (recommended) at `supabase/functions/cleanup_expired_idempotency_keys` or as a versioned SQL migration in `supabase/migrations/` if you choose `pg_cron`.
