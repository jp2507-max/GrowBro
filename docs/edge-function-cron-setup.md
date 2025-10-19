# Edge Function Cron Configuration

## Idempotency Key Cleanup

The `cleanup-idempotency-keys` Edge Function needs to run on a 6-hour schedule to clean up expired idempotency keys.

### Setup Instructions

#### Option 1: Supabase Dashboard (Recommended for Production)

1. Navigate to **Database > Functions** in Supabase Dashboard
2. Select `cleanup-idempotency-keys` function
3. Click **Settings** > **Cron Jobs**
4. Add new cron job with schedule: `0 */6 * * *` (every 6 hours)

#### Option 2: deno.json Configuration (For Local Development)

Add to each Edge Function's `deno.json`:

```json
{
  "crons": {
    "cleanup-idempotency-keys": {
      "schedule": "0 */6 * * *",
      "path": "/cleanup-idempotency-keys"
    }
  }
}
```

### Security Setup

1. Generate a secure random secret:

   ```bash
   openssl rand -hex 32
   ```

2. Add to Supabase secrets:
   - Key: `CRON_SECRET`
   - Value: [generated secret]

3. The Edge Function validates requests using this secret in the `Authorization` header

### Monitoring

The cleanup function logs:

- Number of keys deleted
- Timestamp of execution
- Any errors encountered

Check logs in:

- **Supabase Dashboard**: Edge Functions > cleanup-idempotency-keys > Logs
- **CLI**: `supabase functions logs cleanup-idempotency-keys`

### TTL Configuration

Current TTL values (defined in the Edge Function):

- **Completed operations**: 24 hours (replay window)
- **Failed operations**: 7 days (for debugging)

These align with the idempotency service implementation in `src/lib/community/idempotency-service.ts`.

### Manual Invocation (Testing)

```bash
curl -X POST "https://[project-ref].supabase.co/functions/v1/cleanup-idempotency-keys" \
  -H "Authorization: Bearer [your-anon-key]" \
  -H "Content-Type: application/json"
```

### Alerting (Recommended)

Set up monitoring for:

1. **Cleanup failures**: Alert if function returns 500 status
2. **Table growth**: Alert if `idempotency_keys` table exceeds expected size
3. **Execution frequency**: Alert if cron job hasn't run in >7 hours
