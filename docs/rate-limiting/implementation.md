# Rate Limiting Implementation

## Overview

Per-user rate limiting has been implemented across all critical API endpoints to prevent abuse and ensure fair resource usage. The implementation uses a database-backed counter system with automatic TTL cleanup.

## Architecture

### Database Layer

**Table**: `public.rate_limits`

```sql
CREATE TABLE public.rate_limits (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  counter INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT ux_rate_limits_user_endpoint_window UNIQUE (user_id, endpoint, window_start)
);
```

**Key Features**:

- Atomic counter increments via PostgreSQL function
- Hourly time windows (aligned to hour boundaries)
- Automatic TTL-based expiration
- Concurrent-safe operations

### Middleware Layer

**Location**: `supabase/functions/_shared/rate-limit.ts`

**Core Functions**:

- `checkRateLimit()` - Atomically increment and check threshold
- `createRateLimitResponse()` - Generate 429 response with headers
- `withRateLimit()` - Convenient middleware wrapper

**Safety Features**:

- Fail-open on database errors (allows request)
- Atomic increments prevent race conditions
- Configurable limits and time windows

## Rate Limits by Endpoint

| Endpoint       | Limit   | Window | Batch-Aware | Implementation |
| -------------- | ------- | ------ | ----------- | -------------- |
| AI Assessments | 10/hour | 3600s  | No          | `ai-inference` |
| Task Creation  | 50/hour | 3600s  | Yes         | `sync-push`    |
| Post Creation  | 5/hour  | 3600s  | No          | `create-post`  |

### Assessment Creation

**Endpoint**: `ai-inference`  
**Limit**: 10 assessments per hour per user

```typescript
const rateLimitResponse = await withRateLimit(
  supabaseClient,
  user.id,
  {
    endpoint: 'assessments',
    limit: 10,
    windowSeconds: 3600,
  },
  corsHeaders
);
```

### Task Creation (Batch-Aware)

**Endpoint**: `sync-push`  
**Limit**: 50 tasks per hour per user

```typescript
const taskCount = countTasksInChanges(changes);

if (taskCount > 0) {
  const rateLimitResponse = await withRateLimit(
    client,
    userId,
    {
      endpoint: 'tasks',
      limit: 50,
      windowSeconds: 3600,
      increment: taskCount, // Batch size
    },
    corsHeaders
  );
}
```

**Batch Counting**: The sync-push endpoint counts the number of tasks in `changes.tasks.created` array and increments the rate limit counter by that amount, ensuring batch operations are properly rate limited.

### Post Creation

**Endpoint**: `create-post`  
**Limit**: 5 posts per hour per user

```typescript
const rateLimitResponse = await withRateLimit(
  supabaseClient,
  user.id,
  {
    endpoint: 'posts',
    limit: 5,
    windowSeconds: 3600,
  },
  corsHeaders
);
```

## HTTP Response Format

### Success Response (Within Limit)

```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 2025-10-28T08:00:00.000Z
```

### Rate Limit Exceeded Response

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 3540
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 2025-10-28T08:00:00.000Z
Content-Type: application/json

{
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "message": "Too many requests. Limit: 10 per hour. Current: 11. Try again in 3540 seconds.",
  "limit": 10,
  "current": 11,
  "retryAfter": 3540
}
```

## Database Functions

### increment_rate_limit

Atomically increments the rate limit counter and checks if the limit is exceeded.

```sql
CREATE OR REPLACE FUNCTION public.increment_rate_limit(
  p_user_id UUID,
  p_endpoint TEXT,
  p_limit INTEGER,
  p_window_seconds INTEGER,
  p_increment INTEGER DEFAULT 1
)
RETURNS jsonb
```

**Returns**:

```json
{
  "allowed": true,
  "current": 5,
  "limit": 10,
  "retryAfter": 0
}
```

### cleanup_expired_rate_limits

Removes expired rate limit entries. Should be called periodically via cron job.

```sql
SELECT public.cleanup_expired_rate_limits();
```

## Testing

### Unit Tests

**Location**: `supabase/functions/_shared/rate-limit.test.ts`

**Coverage**:

- ✅ Allows requests within limit
- ✅ Blocks requests when limit exceeded
- ✅ Handles batch increments correctly
- ✅ Fails open on database errors
- ✅ Generates correct 429 responses
- ✅ Includes Retry-After header
- ✅ Enforces minimum retry-after of 1 second

### Integration Testing

```bash
# Test assessment rate limiting
for i in {1..15}; do
  curl -X POST https://your-project.supabase.co/functions/v1/ai-inference \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"assessmentId":"test","images":[]}'
done

# Expected: First 10 succeed, next 5 return 429
```

## Monitoring

### Key Metrics

1. **Rate Limit Hit Rate**: Percentage of requests blocked by rate limiting
2. **Counter Distribution**: Distribution of counter values per endpoint
3. **Retry-After Values**: Distribution of retry-after times
4. **Cleanup Performance**: Time to clean up expired entries

### Queries

```sql
-- Current rate limit status by user
SELECT
  user_id,
  endpoint,
  counter,
  expires_at - now() as time_remaining
FROM rate_limits
WHERE expires_at > now()
ORDER BY counter DESC;

-- Rate limit violations in last hour
SELECT
  endpoint,
  COUNT(*) as violation_count
FROM rate_limits
WHERE counter > CASE endpoint
  WHEN 'assessments' THEN 10
  WHEN 'tasks' THEN 50
  WHEN 'posts' THEN 5
END
AND created_at > now() - interval '1 hour'
GROUP BY endpoint;
```

## Maintenance

### Cleanup Schedule

Run cleanup function hourly via pg_cron or external scheduler:

```sql
-- Add to cron schedule
SELECT cron.schedule(
  'cleanup-rate-limits',
  '0 * * * *', -- Every hour
  'SELECT public.cleanup_expired_rate_limits()'
);
```

### Adjusting Limits

To adjust rate limits, update the limit parameter in the Edge Function:

```typescript
// Before
limit: 10,

// After
limit: 20,
```

No database migration required - limits are enforced at application layer.

## Security Considerations

### Concurrency Safety

- Uses PostgreSQL's `INSERT ... ON CONFLICT DO UPDATE` for atomic operations
- Window boundaries aligned to hour start to prevent drift
- Unique constraint on `(user_id, endpoint, window_start)` prevents duplicates

### Fail-Open Strategy

If the rate limit check fails due to database error:

- Request is **allowed** (fail-open)
- Error is logged for monitoring
- Prevents legitimate users from being blocked by transient issues

### Attack Mitigation

1. **Distributed Attacks**: Per-user limits prevent single user abuse
2. **Batch Attacks**: Batch-aware counting prevents circumvention via sync operations
3. **Clock Skew**: Server-side timestamps prevent client manipulation
4. **Retry Storms**: Retry-After header guides clients to back off

## Migration Path

### Applying the Migration

```bash
# Apply migration
supabase db push

# Or via Supabase MCP tool
mcp3_apply_migration --name create_rate_limits_table --query "..."
```

### Rollback Plan

If rate limiting causes issues:

1. **Disable at application layer**: Comment out rate limit checks in Edge Functions
2. **Increase limits**: Temporarily raise limits while investigating
3. **Drop table**: `DROP TABLE IF EXISTS public.rate_limits CASCADE;`

## Future Enhancements

- [ ] Add Redis caching layer for high-traffic scenarios
- [ ] Implement sliding window algorithm for smoother limits
- [ ] Add per-IP rate limiting for unauthenticated endpoints
- [ ] Expose rate limit metrics in admin dashboard
- [ ] Add rate limit bypass for premium users
- [ ] Implement dynamic rate limits based on system load

## References

- [Security Audit Checklist](../testing/security-audit.md#rate-limiting)
- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [HTTP 429 Status Code](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429)
- [Retry-After Header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Retry-After)
