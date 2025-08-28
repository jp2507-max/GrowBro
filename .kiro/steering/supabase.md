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
  2. Deploy the function `cleanup_expired_idempotency_keys`.
  3. Enable/schedule the job.
