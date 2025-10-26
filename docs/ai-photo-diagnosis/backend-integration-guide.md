# Backend Integration Guide - Model Lifecycle Management

## Quick Start Checklist

- [ ] Run database migration
- [ ] Create Supabase Edge Function for model config
- [ ] Set up storage bucket and upload model files
- [ ] Configure RLS policies
- [ ] Test model download flow
- [ ] Set up monitoring and alerts

## 1. Database Migration

Run the migration to create the `model_metadata` table:

```bash
# Apply migration
supabase db push

# Or manually run
psql $DATABASE_URL -f supabase/migrations/20250126_create_model_metadata_table.sql
```

Verify the table was created:

```sql
SELECT * FROM public.model_metadata WHERE version = 'v1.0.0';
```

Update the placeholder checksum with the actual value:

```sql
UPDATE public.model_metadata
SET checksum_sha256 = 'actual_sha256_checksum_here'
WHERE version = 'v1.0.0';
```

## 2. Supabase Edge Function: `assessment-model-config`

Create a new Edge Function to serve model configuration:

**File**: `supabase/functions/assessment-model-config/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-app-platform, x-device-tier, x-locale, if-none-match',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get request headers
    const platform = req.headers.get('X-App-Platform') || 'universal';
    const ifNoneMatch = req.headers.get('If-None-Match');

    // Query active model configuration
    const { data, error } = await supabase
      .from('model_metadata')
      .select('*')
      .eq('status', 'active')
      .eq('is_stable', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      throw error;
    }

    if (!data) {
      return new Response(JSON.stringify({ error: 'No active model found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate ETag from version and updated_at
    const etag = `"${data.version}-${data.updated_at}"`;

    // Check if client has cached version
    if (ifNoneMatch === etag) {
      return new Response(null, {
        status: 304,
        headers: { ...corsHeaders, ETag: etag },
      });
    }

    // Build response
    const response = {
      activeModelVersion: data.version,
      rolloutPercentage: data.rollout_percentage,
      shadowModelVersion: data.shadow_mode
        ? await getShadowVersion(supabase)
        : undefined,
      shadowPercentage: data.shadow_percentage || undefined,
      rollbackThreshold: parseFloat(data.rollback_threshold),
      minAppVersion: data.min_app_version || undefined,
      updatedAt: data.updated_at,
      etag,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        ETag: etag,
        'Cache-Control': 'public, max-age=21600', // 6 hours
      },
    });
  } catch (error) {
    console.error('Error fetching model config:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function getShadowVersion(supabase: any): Promise<string | undefined> {
  const { data } = await supabase
    .from('model_metadata')
    .select('version')
    .eq('status', 'testing')
    .eq('shadow_mode', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return data?.version;
}
```

Deploy the function:

```bash
supabase functions deploy assessment-model-config
```

Test the function:

```bash
curl -X POST https://your-project.supabase.co/functions/v1/assessment-model-config \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "X-App-Platform: ios"
```

## 3. Storage Bucket Setup

Create the `assessment-models` bucket:

```sql
-- Create bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('assessment-models', 'assessment-models', true);

-- Set up RLS policy for public read access
CREATE POLICY "Public read access to models"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'assessment-models');
```

Or via Supabase Dashboard:

1. Go to Storage → Create Bucket
2. Name: `assessment-models`
3. Public: Yes
4. File size limit: 50 MB

## 4. Upload Model Files

Upload the model and metadata files:

```bash
# Upload model file
supabase storage upload assessment-models/models/plant_classifier_v1.0.0.ort ./path/to/model.ort

# Upload metadata file
supabase storage upload assessment-models/models/plant_classifier_v1.0.0.json ./path/to/metadata.json
```

**Metadata JSON format** (`plant_classifier_v1.0.0.json`):

```json
{
  "version": "v1.0.0",
  "architecture": "EfficientNet-Lite0",
  "quantization": "INT8",
  "inputShape": [1, 224, 224, 3],
  "delegates": ["xnnpack", "nnapi", "coreml"],
  "checksumSha256": "actual_sha256_checksum_here",
  "description": "Initial baseline model for plant health assessment",
  "lastUpdated": "2025-01-26T12:00:00Z"
}
```

Calculate checksum:

```bash
# macOS/Linux
shasum -a 256 plant_classifier_v1.0.0.ort

# Windows PowerShell
Get-FileHash plant_classifier_v1.0.0.ort -Algorithm SHA256
```

## 5. Model Deployment Workflow

### Deploying a New Model Version

1. **Upload model files**:

   ```bash
   supabase storage upload assessment-models/models/plant_classifier_v1.1.0.ort ./model.ort
   supabase storage upload assessment-models/models/plant_classifier_v1.1.0.json ./metadata.json
   ```

2. **Insert metadata record**:

   ```sql
   INSERT INTO public.model_metadata (
     version,
     file_path,
     file_size_bytes,
     checksum_sha256,
     architecture,
     quantization,
     input_shape,
     supported_providers,
     rollout_percentage,
     status
   ) VALUES (
     'v1.1.0',
     'models/plant_classifier_v1.1.0.ort',
     5242880,
     'actual_checksum_here',
     'EfficientNet-Lite0',
     'INT8',
     '{"shape": [1, 224, 224, 3]}'::jsonb,
     '["xnnpack", "nnapi", "coreml"]'::jsonb,
     0, -- Start at 0%
     'testing'
   );
   ```

3. **Enable shadow mode** (optional):

   ```sql
   UPDATE public.model_metadata
   SET shadow_mode = true, shadow_percentage = 10
   WHERE version = 'v1.1.0';
   ```

4. **Gradual rollout**:

   ```sql
   -- 10% rollout
   UPDATE public.model_metadata
   SET rollout_percentage = 10, status = 'active'
   WHERE version = 'v1.1.0';

   -- Monitor error rates, then increase
   UPDATE public.model_metadata
   SET rollout_percentage = 50
   WHERE version = 'v1.1.0';

   -- Full rollout
   UPDATE public.model_metadata
   SET rollout_percentage = 100, is_stable = true
   WHERE version = 'v1.1.0';
   ```

5. **Deprecate old version**:
   ```sql
   UPDATE public.model_metadata
   SET status = 'deprecated', deprecated_at = NOW()
   WHERE version = 'v1.0.0';
   ```

### Rolling Back a Model

If error rates exceed threshold:

```sql
-- Mark problematic version as deprecated
UPDATE public.model_metadata
SET status = 'deprecated', rollout_percentage = 0
WHERE version = 'v1.1.0';

-- Restore previous stable version
UPDATE public.model_metadata
SET rollout_percentage = 100, status = 'active'
WHERE version = 'v1.0.0';
```

## 6. Monitoring Queries

### Check Active Models

```sql
SELECT version, rollout_percentage, status, is_stable, created_at
FROM public.model_metadata
WHERE status IN ('active', 'testing')
ORDER BY created_at DESC;
```

### View Rollout Status

```sql
SELECT
  version,
  rollout_percentage,
  shadow_mode,
  shadow_percentage,
  rollback_threshold,
  status
FROM public.model_metadata
WHERE status = 'active';
```

### Model File Sizes

```sql
SELECT
  version,
  file_size_bytes / 1024 / 1024 AS size_mb,
  architecture,
  quantization
FROM public.model_metadata
ORDER BY created_at DESC;
```

## 7. Testing the Integration

### Test Model Config Endpoint

```bash
# Test basic request
curl -X POST https://your-project.supabase.co/functions/v1/assessment-model-config \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "X-App-Platform: ios" \
  | jq

# Test ETag caching
ETAG=$(curl -sI -X POST https://your-project.supabase.co/functions/v1/assessment-model-config \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  | grep -i etag | cut -d' ' -f2)

curl -X POST https://your-project.supabase.co/functions/v1/assessment-model-config \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "If-None-Match: $ETAG" \
  -w "\nHTTP Status: %{http_code}\n"
```

### Test Model Download

```bash
# Get signed URL
curl -X POST https://your-project.supabase.co/storage/v1/object/sign/assessment-models/models/plant_classifier_v1.0.0.ort \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"expiresIn": 3600}' \
  | jq -r '.signedURL'

# Download model
wget "SIGNED_URL_HERE" -O model.ort

# Verify checksum
shasum -a 256 model.ort
```

## 8. Security Checklist

- [ ] Service role key is used for Edge Function (not anon key)
- [ ] RLS policies are enabled on `model_metadata` table
- [ ] Storage bucket has public read access (models only)
- [ ] Signed URLs expire after 1 hour
- [ ] Model checksums are validated on client
- [ ] Edge Function has CORS headers configured
- [ ] Rate limiting is configured (if needed)

## 9. Monitoring and Alerts

Set up monitoring for:

1. **Error Rate Spikes**:
   - Alert when error rate > rollback threshold
   - Track per model version

2. **Download Failures**:
   - Monitor 4xx/5xx responses from storage
   - Track checksum validation failures

3. **Config Fetch Failures**:
   - Alert on Edge Function errors
   - Monitor cache hit rate

4. **Storage Metrics**:
   - Track bandwidth usage
   - Monitor storage costs

## 10. Troubleshooting

### Model Download Fails

Check storage bucket permissions:

```sql
SELECT * FROM storage.buckets WHERE id = 'assessment-models';
SELECT * FROM storage.objects WHERE bucket_id = 'assessment-models';
```

### Config Endpoint Returns 404

Verify active model exists:

```sql
SELECT * FROM public.model_metadata WHERE status = 'active' AND is_stable = true;
```

### Checksum Validation Fails

Recalculate and update checksum:

```bash
shasum -a 256 model.ort
```

```sql
UPDATE public.model_metadata
SET checksum_sha256 = 'correct_checksum_here'
WHERE version = 'v1.0.0';
```

## Support

For issues or questions:

- Check logs: `supabase functions logs assessment-model-config`
- Review storage logs in Supabase Dashboard
- Verify RLS policies are not blocking requests
