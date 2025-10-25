# Inference Microservice (Node/Container)

Heavy ML inference service using onnxruntime-node. Runs separately from Edge Functions to avoid WASM size/memory constraints.

## Architecture

This service is deployed as a separate Node.js container (e.g., Cloud Run, Fly.io, Railway) and called by the `ai-inference` Edge Function.

## Stack

- **Runtime**: Node.js 20+
- **ML Framework**: onnxruntime-node
- **Models**: EfficientNet-B4 or ResNet-50 (full precision)
- **Container**: Docker with model caching

## Request

**Endpoint**: `POST /`

**Headers**:

- `Content-Type: application/json`
- `X-User-Id: <user-id>` (from Edge Function)

**Body**: Same as Edge Function request (CloudInferenceRequest)

## Response

Same as Edge Function response (CloudInferenceResponse)

## Implementation Notes

- Load model on startup and cache in memory
- Use warm containers to avoid cold start latency
- Implement model versioning and hot-swapping
- Log inference metrics for monitoring
- Handle OOM gracefully with error responses

## Deployment

```bash
# Build container
docker build -t inference-service .

# Run locally
docker run -p 8080:8080 -e MODEL_PATH=/models/efficientnet-b4.onnx inference-service

# Deploy to Cloud Run
gcloud run deploy inference-service \
  --image gcr.io/project/inference-service \
  --platform managed \
  --region us-central1 \
  --memory 2Gi \
  --cpu 2 \
  --max-instances 10
```

## Environment Variables

- `MODEL_PATH`: Path to ONNX model file
- `MODEL_VERSION`: Model version string
- `PORT`: HTTP server port (default: 8080)

## TODO

- [ ] Implement actual onnxruntime-node inference
- [ ] Add model loading and caching
- [ ] Implement preprocessing pipeline
- [ ] Add temperature scaling
- [ ] Implement batch processing
- [ ] Add metrics and logging
- [ ] Create Dockerfile
- [ ] Add health check endpoint
- [ ] Implement graceful shutdown
- [ ] Add integration tests
