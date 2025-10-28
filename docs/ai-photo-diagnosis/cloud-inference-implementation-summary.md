# Cloud ML Inference Fallback - Implementation Summary

**Task**: 3.2 - Create cloud-based ML inference fallback system  
**Status**: Core implementation complete; telemetry and tests pending  
**Date**: 2025-01-25

## Overview

Implemented a robust cloud-based ML inference fallback system that allows the mobile app to offload heavy inference to a cloud microservice when on-device inference fails or is unavailable.

## Architecture

```
Mobile App (CloudInferenceClient)
    ↓ JWT + Idempotency Key
Supabase Edge Function (ai-inference)
    ↓ Proxy with timeout
Node/Container Microservice (onnxruntime-node)
    ↓ Heavy inference
Response (cached for 24h)
```

## Implemented Components

### 1. Type Definitions (`src/types/cloud-inference.ts`)

- `CloudInferenceRequest`: Request payload with images, plant context, client info
- `CloudInferenceResponse`: Response with success, result, or error
- `CloudInferenceError`: Typed error with category and retry guidance
- `CloudInferencePredictOptions`: Options for predict method
- `UploadedImage`: Image upload metadata with signed URLs

### 2. Cloud Inference Client (`src/lib/assessment/cloud-inference-client.ts`)

**Features**:

- Uploads images to Supabase Storage with integrity hashes
- Generates signed URLs (1-hour expiry)
- Calls Edge Function with idempotency key
- 8s hard timeout with abort controller
- Typed error handling with retry guidance

**Key Methods**:

- `predict(options)`: Main inference method
- `uploadImages()`: Upload to storage and generate signed URLs
- `callEdgeFunction()`: Invoke Edge Function with timeout
- `getClientInfo()`: Collect telemetry metadata

### 3. Supabase Edge Function (`supabase/functions/ai-inference/index.ts`)

**Features**:

- JWT authentication via `getUser()`
- RLS enforcement on all queries
- Idempotency via `idempotency_keys` table (24h TTL)
- 5s p95 timeout target
- Proxies to inference microservice
- Caches responses for duplicate requests

**Security**:

- Never uses service key for user-scoped operations
- Validates JWT on every request
- Idempotency keys scoped to `user_id`
- CORS headers for web clients

### 4. Database Schema (Existing `idempotency_keys` table)

**Note**: The `idempotency_keys` table already exists in the database with a compatible schema.

**Table Schema**:

- `id`: UUID PRIMARY KEY
- `idempotency_key`: TEXT NOT NULL (used by cloud inference)
- `user_id`: UUID NOT NULL REFERENCES auth.users(id)
- `endpoint`: TEXT NOT NULL (set to 'ai-inference')
- `status`: TEXT NOT NULL ('completed', 'failed', 'pending')
- `request_payload`: JSONB (stores CloudInferenceRequest)
- `response_payload`: JSONB (stores CloudInferenceResponse)
- `created_at`: TIMESTAMPTZ NOT NULL DEFAULT NOW()
- `expires_at`: TIMESTAMPTZ NOT NULL (24h TTL)
- `client_tx_id`: TEXT
- `payload_hash`: TEXT
- `error_details`: JSONB

**Existing RLS Policies**:

- Users can view their own idempotency keys
- Users can insert their own idempotency keys
- Users can manage own idempotency keys
- Users can update their own idempotency keys
- Service role can manage all idempotency keys

### 5. Inference Coordinator Updates (`src/lib/assessment/inference-coordinator.ts`)

**Enhanced Features**:

- Cloud fallback on device inference failure
- Deadline budget tracking across device → cloud transition
- Validates required parameters (plantContext, assessmentId)
- Passes through model version hints

**Flow**:

1. Try device inference with deadline
2. On failure, check if cloud fallback enabled
3. Calculate remaining time budget
4. If >1s remaining, attempt cloud inference
5. Otherwise, throw original error

### 6. Module Exports (`src/lib/assessment/index.ts`)

Added exports for:

- `CloudInferenceClient`
- `getCloudInferenceClient()`
- `resetCloudInferenceClient()`

## Implementation Details

### Idempotency

- Client generates UUID v4 for each request
- Edge Function checks `idempotency_keys` table before processing
- Cached responses returned immediately for duplicate keys
- 24-hour TTL with automatic cleanup

### Timeout Handling

- **Mobile app**: 8s hard timeout with abort controller
- **Edge Function**: 5s p95 target for microservice call
- **Coordinator**: Tracks total budget across device → cloud fallback

### Error Handling

Typed errors with categories:

- `network`: Connectivity issues (retryable)
- `auth`: Authentication failures (not retryable)
- `timeout`: Deadline exceeded (not retryable)
- `server`: Microservice errors (retryable)
- `validation`: Invalid request (not retryable)

### Image Upload

1. Read image from local URI
2. Compute SHA-256 integrity hash
3. Upload to `assessment-images` bucket
4. Generate signed URL (1h expiry)
5. Pass signed URL to Edge Function

## Files Created

### Mobile App

- `src/types/cloud-inference.ts` - Type definitions
- `src/lib/assessment/cloud-inference-client.ts` - Client implementation

### Backend

- `supabase/functions/ai-inference/index.ts` - Edge Function
- `supabase/functions/ai-inference/README.md` - Documentation
- `supabase/migrations/20250125_create_idempotency_keys_table.sql` - Schema documentation (table already exists)
- `supabase/functions/_inference-service/README.md` - Microservice stub docs

### Documentation

- `docs/ai-photo-diagnosis/cloud-inference-implementation-summary.md` - This file

## Files Modified

- `src/lib/assessment/inference-coordinator.ts` - Added cloud fallback logic
- `src/lib/assessment/index.ts` - Added cloud client exports

## Pending Work

### 1. Inference Microservice (High Priority)

**Location**: `supabase/functions/_inference-service/`

**Requirements**:

- Node.js 20+ with onnxruntime-node
- Load EfficientNet-B4 or ResNet-50 model
- Implement preprocessing pipeline
- Apply temperature scaling calibration
- Return `CloudInferenceResponse` format
- Docker container with model caching
- Health check endpoint
- Graceful shutdown

**Deployment Options**:

- Google Cloud Run
- Fly.io
- Railway
- AWS Lambda (with container support)

### 2. Telemetry & Performance Logging (Medium Priority)

**Extend** `src/lib/assessment/inference-telemetry.ts`:

- `logCloudInferenceSuccess()`
- `logCloudInferenceFailure()`
- `logImageUpload()`
- `logIdempotencyHit()`
- Track p50/p95/p99 latencies
- Monitor fallback rate
- Alert on high error rates

### 3. Unit Tests (Medium Priority)

**Cloud Inference Client** (`src/lib/assessment/__tests__/cloud-inference-client.test.ts`):

- Mock Supabase client
- Test upload flow
- Test Edge Function invocation
- Test timeout handling
- Test error scenarios

**Inference Coordinator** (`src/lib/assessment/__tests__/inference-coordinator.test.ts`):

- Test device → cloud fallback
- Test deadline budget tracking
- Test parameter validation
- Test mode selection (auto/device/cloud)

### 4. Integration Tests (Medium Priority)

**End-to-End Flow**:

- Upload test images
- Call Edge Function
- Verify idempotency
- Test timeout scenarios
- Verify RLS enforcement

### 5. Edge Function Enhancements (Low Priority)

- Add request validation with Zod
- Implement rate limiting per user
- Add metrics export (Prometheus format)
- Implement graceful degradation
- Add circuit breaker for microservice

## Configuration

### Environment Variables

**Mobile App** (`.env`):

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

**Edge Function** (Supabase Dashboard):

```bash
INFERENCE_SERVICE_URL=https://inference-service.example.com
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

**Inference Microservice**:

```bash
MODEL_PATH=/models/efficientnet-b4.onnx
MODEL_VERSION=v1.0.0
PORT=8080
```

## Deployment Steps

### 1. Verify Database Schema

The `idempotency_keys` table already exists. Verify it's accessible:

```bash
# Check table exists
supabase db inspect idempotency_keys
```

### 2. Deploy Edge Function

```bash
# Deploy to Supabase
supabase functions deploy ai-inference

# Set environment variables
supabase secrets set INFERENCE_SERVICE_URL=https://...
```

### 3. Deploy Inference Microservice

```bash
# Build Docker image
docker build -t inference-service ./supabase/functions/_inference-service

# Deploy to Cloud Run (example)
gcloud run deploy inference-service \
  --image gcr.io/project/inference-service \
  --platform managed \
  --region us-central1 \
  --memory 2Gi \
  --cpu 2 \
  --max-instances 10
```

### 4. Update Mobile App Config

```bash
# Ensure SUPABASE_URL and SUPABASE_ANON_KEY are set
# Rebuild app
pnpm build
```

## Testing Locally

### 1. Start Supabase Locally

```bash
supabase start
supabase functions serve ai-inference
```

### 2. Mock Inference Service

```bash
# Create simple mock server
node supabase/functions/_inference-service/mock-server.js
```

### 3. Run Mobile App

```bash
pnpm start
```

### 4. Trigger Cloud Inference

```typescript
import { runInference } from '@/lib/assessment';

const result = await runInference(photos, {
  mode: 'cloud',
  plantContext: { id: 'plant-123' },
  assessmentId: 'assessment-456',
});
```

## Performance Targets

- **p50 latency**: ≤2s end-to-end
- **p95 latency**: ≤5s end-to-end
- **p99 latency**: ≤8s end-to-end
- **Availability**: 99.9% (excluding microservice)
- **Fallback rate**: <10% of requests
- **Idempotency hit rate**: <5% (duplicate requests)

## Security Considerations

- ✅ JWT authentication on every request
- ✅ RLS enforcement on all database operations
- ✅ Idempotency keys scoped to user_id
- ✅ Signed URLs with 1-hour expiry
- ✅ SHA-256 integrity hashes for images
- ✅ CORS headers for web clients
- ✅ No service key usage for user-scoped operations
- ⚠️ TODO: Rate limiting per user
- ⚠️ TODO: Request size validation
- ⚠️ TODO: Image content validation (MIME type, dimensions)

## Monitoring & Alerts

**Metrics to Track**:

- Cloud inference request rate
- Success/failure rate
- Latency percentiles (p50/p95/p99)
- Fallback rate
- Idempotency hit rate
- Image upload failures
- Microservice availability

**Alerts**:

- p95 latency >5s for 5 minutes
- Error rate >5% for 5 minutes
- Microservice unavailable
- Idempotency table size >1M rows

## Known Limitations

1. **Microservice not implemented**: Placeholder returns error
2. **No telemetry**: Metrics not collected yet
3. **No tests**: Unit and integration tests pending
4. **No rate limiting**: Users can spam requests
5. **No request validation**: Zod schemas not implemented
6. **No cleanup job**: Expired idempotency keys accumulate

## Next Steps

1. **Implement inference microservice** (blocking for production)
2. **Add telemetry and monitoring** (critical for observability)
3. **Write unit and integration tests** (required for CI/CD)
4. **Add rate limiting** (prevent abuse)
5. **Implement cleanup job** (prevent table bloat)
6. **Add request validation** (improve error messages)
7. **Performance testing** (verify SLOs)
8. **Load testing** (verify scalability)

## References

- Design doc: `.kiro/specs/19. ai-photo-diagnosis/design.md`
- Requirements: `.kiro/specs/19. ai-photo-diagnosis/requirements.md`
- Tasks: `.kiro/specs/19. ai-photo-diagnosis/tasks.md`
- Edge Function README: `supabase/functions/ai-inference/README.md`
- Microservice README: `supabase/functions/_inference-service/README.md`
