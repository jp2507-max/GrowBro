# Idempotency Implementation Guide

## Overview

The community feed implements comprehensive idempotency to ensure reliable operations across network failures, retries, and concurrent requests. This prevents duplicate posts, likes, and comments while maintaining data consistency.

## Database Schema

### Idempotency Keys Table

```sql
CREATE TABLE idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL,
  client_tx_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  -- response_payload is nullable while a request is 'processing'.
  -- Initial INSERTs may set this to NULL and a later UPDATE will fill the final payload.
  response_payload JSONB,
  status TEXT NOT NULL CHECK (status IN ('completed', 'processing', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
  -- TTL behavior: default expiry is 24 hours. On transition to 'completed' set/extend
  -- expires_at = now() + INTERVAL '24 hours'. On transition to 'failed' set/extend
  -- expires_at = now() + INTERVAL '7 days' so failed records are retained for debugging but
  -- still removable by the scheduled cleanup job.
  UNIQUE(idempotency_key, user_id, endpoint)
);

-- Performance indexes
CREATE INDEX idx_idempotency_keys_lookup ON idempotency_keys (idempotency_key, user_id, endpoint);
-- Include both completed and failed so the cleanup job can efficiently find expired rows
CREATE INDEX idx_idempotency_keys_cleanup ON idempotency_keys (expires_at)
  WHERE status IN ('completed', 'failed');
CREATE INDEX idx_idempotency_keys_user_recent ON idempotency_keys (user_id, created_at DESC);
```

### Key Design Decisions

- **Composite Unique Key**: `(idempotency_key, user_id, endpoint)` ensures keys are scoped per user and endpoint
- **TTL Management**: `expires_at` column with automatic cleanup prevents table bloat
- **Status Tracking**: Handles concurrent processing and provides debugging visibility
- **Payload Hash**: SHA-256 hash detects conflicting payloads for same idempotency key

## Server-Side Implementation

### Core Service Pattern

````typescript
class IdempotencyService {
  async processWithIdempotency<T>(
    key: string,
    clientTxId: string,
    userId: string,
    endpoint: string,
    payload: any,
    operation: () => Promise<T>
  ): Promise<T> {
    const payloadHash = await this.computeHash(payload);

    // Atomic UPSERT - single writer semantics
    const result = await this.db.transaction(async (tx) => {
      // Try to insert new idempotency key
      const inserted = await tx.query(
        `
  INSERT INTO idempotency_keys
  (idempotency_key, client_tx_id, user_id, endpoint, payload_hash, response_payload, status)
  VALUES ($1, $2, $3, $4, $5, NULL, 'processing')
        ON CONFLICT (idempotency_key, user_id, endpoint) DO NOTHING
        RETURNING *
      `,
        [key, clientTxId, userId, endpoint, payloadHash]
      );

      if (inserted.length === 0) {
        // Key already exists - fetch existing record
        const existing = await tx.query(
          `
          SELECT * FROM idempotency_keys
          WHERE idempotency_key = $1 AND user_id = $2 AND endpoint = $3
        `,
          [key, userId, endpoint]
        );

        const record = existing[0];

        // Validate payload hash
        if (record.payload_hash !== payloadHash) {
          throw new ConflictingPayloadError(
            'Idempotency key reused with different payload'
          );
        }

        // Return cached response if completed
        if (record.status === 'completed') {
          return record.response_payload;
        }

        // Handle processing state (wait or retry)
        if (record.status === 'processing') {
          throw new ProcessingError('Request already being processed');
        }
      }

      // Execute the operation
      const operationResult = await operation();

      // Store successful result
      await tx.query(
        `
        UPDATE idempotency_keys
        SET response_payload = $1, status = 'completed'
        WHERE idempotency_key = $2 AND user_id = $3 AND endpoint = $4
      `,
        [JSON.stringify(operationResult), key, userId, endpoint]
      );

      return operationResult;
    });

    return result;
  }

  private async computeHash(payload: any): Promise<string> {
    // Deterministic serializer: recursively stringify with sorted object keys.
    function deterministicStringify(value: any): string {
      if (value === null) return 'null';
      const t = typeof value;
      if (t === 'number' || t === 'boolean') return String(value);
      if (t === 'string') return JSON.stringify(value);

      if (Array.isArray(value)) {
        // Arrays are order-sensitive; serialize each item in order
        return (
          '[' + value.map((v) => deterministicStringify(v)).join(',') + ']'
        );
      }

      if (t === 'object') {
        const keys = Object.keys(value).sort();
        return (
          '{' +
          keys
            .map(
              (k) => JSON.stringify(k) + ':' + deterministicStringify(value[k])
            )
            .join(',') +
        );
      }

          DO $$
          DECLARE
            deleted_count integer := 0;
          BEGIN
            -- perform the delete
            DELETE FROM posts
            WHERE created_at < now() - interval '30 days';

            -- capture number of rows deleted
            GET DIAGNOSTICS deleted_count = ROW_COUNT;

            -- ensure the cleanup_logs table exists to avoid runtime errors
            CREATE TABLE IF NOT EXISTS cleanup_logs (
              table_name text,
              deleted_count integer,
              cleanup_time timestamp with time zone
            );

            -- insert a log record using the captured deleted_count
            INSERT INTO cleanup_logs (table_name, deleted_count, cleanup_time)
            VALUES ('posts', deleted_count, now());
          END$$;
          ```
      // Fallback for other types (undefined, functions, symbols) - treat as null
      return 'null';
    }

    const normalized = deterministicStringify(payload);
    const encoder = new TextEncoder();
    const data = encoder.encode(normalized);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
}
````

### Header Validation

All mutating endpoints must validate required headers:

```typescript
function validateIdempotencyHeaders(req: Request): {
  key: string;
  clientTxId: string;
} {
  const key = req.headers.get('Idempotency-Key');
  const clientTxId = req.headers.get('X-Client-Tx-Id');

  if (!key || !key.match(/^[a-zA-Z0-9-_]{1,255}$/)) {
    throw new BadRequestError('Missing or invalid Idempotency-Key header');
  }

  if (!clientTxId || !clientTxId.match(/^[a-zA-Z0-9-_]{1,255}$/)) {
    throw new BadRequestError('Missing or invalid X-Client-Tx-Id header');
  }

  return { key, clientTxId };
}
```

### Error Handling

| Scenario                | HTTP Status | Response                                                            | Client Action       |
| ----------------------- | ----------- | ------------------------------------------------------------------- | ------------------- |
| Missing Idempotency-Key | 400         | `{"error": "Missing Idempotency-Key header"}`                       | Fix request, retry  |
| Invalid key format      | 400         | `{"error": "Invalid Idempotency-Key format"}`                       | Fix request, retry  |
| Conflicting payload     | 422         | `{"error": "Idempotency key reused with different payload"}`        | Generate new key    |
| Still processing        | 409         | `{"error": "Request already being processed", "retry_after": 1000}` | Wait and retry      |
| Server error            | 5xx         | Standard error response                                             | Retry with same key |

## Client-Side Implementation

### Outbox Entry Structure

```typescript
interface OutboxEntry {
  id: string;
  idempotencyKey: string; // UUID v4, generated once
  clientTxId: string; // UUID v4, generated once
  operation: 'create_post' | 'like_post' | 'create_comment' | 'delete_post';
  endpoint: string;
  payload: any;
  status: 'pending' | 'failed' | 'confirmed';
  retryCount: number;
  nextRetryAt: Date;
  createdAt: Date;
  lastError?: string;
}
```

### Key Generation Strategy

```typescript
class IdempotencyKeyGenerator {
  static generate(): string {
    // UUID v4 ensures uniqueness across devices and time
    return `${crypto.randomUUID()}-${Date.now()}`;
  }

  static generateClientTxId(): string {
    // Separate UUID for self-echo detection
    return crypto.randomUUID();
  }
}
```

### Retry Logic

```typescript
class OutboxProcessor {
  async processEntry(entry: OutboxEntry): Promise<void> {
    try {
      const response = await this.apiClient.request({
        method: 'POST',
        url: entry.endpoint,
        headers: {
          'Idempotency-Key': entry.idempotencyKey,
          'X-Client-Tx-Id': entry.clientTxId,
        },
        body: entry.payload,
      });

      // Mark as confirmed
      await this.markConfirmed(entry.id, response.data);
    } catch (error) {
      if (error.status === 422) {
        // Conflicting payload - this shouldn't happen with proper key generation
        await this.markFailed(entry.id, 'Conflicting payload');
        return;
      }

      if (error.status === 409) {
        // Still processing - wait and retry
        const retryAfter = error.headers['retry-after'] || 1000;
        await this.scheduleRetry(entry.id, retryAfter);
        return;
      }

      if (error.status >= 500 || error.status === 429) {
        // Server error or rate limit - retry with backoff
        await this.scheduleRetry(
          entry.id,
          this.calculateBackoff(entry.retryCount)
        );
        return;
      }

      // Client error - mark as failed
      await this.markFailed(entry.id, error.message);
    }
  }

  private calculateBackoff(retryCount: number): number {
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s
    return Math.min(1000 * Math.pow(2, retryCount), 32000);
  }
}
```

## Cleanup and Monitoring

### Periodic Cleanup Job

```sql
-- Edge Function scheduled every 6 hours
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_keys()
RETURNS void AS $$
DECLARE
  deleted_count integer := 0;
BEGIN
  DELETE FROM idempotency_keys
  WHERE expires_at < now()
    AND status IN ('completed', 'failed');

  -- capture number of rows deleted
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- ensure the cleanup_logs table exists to avoid runtime errors
  CREATE TABLE IF NOT EXISTS cleanup_logs (
    table_name text,
    deleted_count integer,
    cleanup_time timestamp with time zone
  );

  -- Log cleanup stats using captured deleted_count
  INSERT INTO cleanup_logs (table_name, deleted_count, cleanup_time)
  VALUES ('idempotency_keys', deleted_count, now());
END;
$$ LANGUAGE plpgsql;
```

### Monitoring Metrics

Track these key metrics:

- **Idempotency hit rate**: % of requests that return cached responses
- **Cleanup effectiveness**: Keys deleted per cleanup run
- **Table growth rate**: New keys created per hour
- **Error rates**: 422 Unprocessable Entity responses, 409 processing conflicts
- **TTL violations**: Keys accessed after expiration

### Rate Limiting

Implement per-user rate limiting:

```sql
-- Check user's recent idempotency key usage
SELECT COUNT(*) FROM idempotency_keys
WHERE user_id = $1
  AND created_at > now() - INTERVAL '1 hour';
```

Limit: 1000 idempotency keys per user per hour.

## Testing Strategy

### Unit Tests

1. **Basic idempotency**: Same key returns same result
2. **Payload validation**: Different payload with same key returns 422
3. **Concurrent processing**: Multiple requests with same key handle race conditions
4. **TTL expiration**: Expired keys allow new operations
5. **Header validation**: Missing/invalid headers return 400
6. **Cleanup job**: Removes expired keys without affecting active ones

### Integration Tests

1. **Cross-device consistency**: Same operation from multiple devices
2. **Network failure recovery**: Retry with same key after network error
3. **Real-time synchronization**: Idempotent operations sync correctly
4. **Performance under load**: High concurrency with duplicate keys

### End-to-End Tests

1. **Complete offline workflow**: Create post offline, sync with idempotency
2. **Multi-device conflict**: Same action from two devices simultaneously
3. **Retry scenarios**: Network failures with automatic retry
4. **Cleanup verification**: Expired keys are properly removed

## Security Considerations

### Row Level Security

```sql
-- Users can only access their own idempotency keys
CREATE POLICY "Users can manage own idempotency keys" ON idempotency_keys
  FOR ALL USING (auth.uid() = user_id);

-- Service role can manage all keys for cleanup
CREATE POLICY "Service role can manage all idempotency keys" ON idempotency_keys
  FOR ALL USING (auth.role() = 'service_role');
```

### Key Format Validation

- Idempotency keys: `^[a-zA-Z0-9-_]{1,255}$`
- Client transaction IDs: `^[a-zA-Z0-9-_]{1,255}$`
- Reject keys with special characters to prevent injection attacks

### Payload Hash Security

- Use SHA-256 for cryptographic security
- Normalize JSON before hashing to ensure consistency
- Store hash, not original payload, to reduce storage and privacy risks

## Performance Optimization

### Database Indexes

- **Lookup index**: Fast key resolution for duplicate detection
- **Cleanup index**: Efficient expired key removal
- **User index**: Rate limiting and user-specific queries

### Memory Management

- Limit response payload size in idempotency_keys table
- Use JSONB compression for large responses
- Implement payload size limits (e.g., 1MB max)

### Connection Pooling

- Use connection pooling for high-concurrency scenarios
- Implement proper transaction timeout handling
- Monitor database connection usage and query performance
