# AI Inference Edge Function

Authenticated gateway for cloud-based ML inference. Proxies requests to a Node/Container microservice running onnxruntime-node.

## Architecture

```
Mobile App → Edge Function (JWT auth, idempotency) → Inference Microservice (onnxruntime-node)
```

## Request

**Endpoint**: `POST /ai-inference`

**Headers**:

- `Authorization: Bearer <JWT>`
- `X-Idempotency-Key: <uuid-v4>`
- `Content-Type: application/json`

**Body**:

```json
{
  "idempotencyKey": "uuid-v4",
  "assessmentId": "assessment-id",
  "modelVersion": "v1.0.0",
  "images": [
    {
      "id": "photo-1",
      "url": "https://signed-url",
      "sha256": "hash",
      "contentType": "image/jpeg"
    }
  ],
  "plantContext": {
    "id": "plant-id",
    "metadata": {}
  },
  "client": {
    "appVersion": "1.0.0",
    "platform": "android",
    "deviceModel": "Pixel 6a"
  }
}
```

## Response

```json
{
  "success": true,
  "mode": "cloud",
  "modelVersion": "v1.0.0",
  "processingTimeMs": 1234,
  "result": {
    "topClass": {...},
    "rawConfidence": 0.92,
    "calibratedConfidence": 0.89,
    "perImage": [...],
    "aggregationMethod": "majority-vote",
    "processingTimeMs": 1234,
    "mode": "cloud",
    "modelVersion": "v1.0.0"
  }
}
```

## Error Response

```json
{
  "success": false,
  "mode": "cloud",
  "modelVersion": "unknown",
  "processingTimeMs": 1234,
  "error": {
    "code": "TIMEOUT",
    "message": "Inference timeout exceeded"
  }
}
```

## Environment Variables

- `INFERENCE_SERVICE_URL`: URL of the inference microservice
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_ANON_KEY`: Supabase anon key

## Features

- **JWT Authentication**: Validates user via `getUser()` from JWT bearer token
- **RLS Enforcement**: All database operations use user context, never service key
- **Idempotency**: Duplicate requests (same idempotency key) return cached response
- **Timeout Handling**: 5s p95 target with graceful degradation
- **Error Handling**: Typed error responses with retry guidance

## Security

- Never uses service key for user-scoped operations
- Enforces RLS on all database queries
- Validates JWT on every request
- Idempotency keys scoped to user_id

## Performance

- Target: p95 ≤ 5s end-to-end
- Hard timeout: 5s with abort controller
- Cached responses for duplicate requests
- Automatic cleanup of expired idempotency keys (24h TTL)
