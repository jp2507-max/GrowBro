# Quality Remote Configuration System

## Overview

The Quality Remote Configuration system allows dynamic adjustment of photo quality assessment thresholds without requiring app updates. This enables A/B testing, device-specific tuning, and rapid iteration on quality standards.

## Architecture

### Components

1. **Database Table** (`quality_thresholds`)
   - Stores threshold configurations with platform and device tier targeting
   - Supports versioning and rollout percentage for gradual deployments
   - Located in: `supabase/migrations/20251025_create_quality_thresholds.sql`

2. **Edge Function** (`quality-config`)
   - Fetches appropriate thresholds based on platform and device tier
   - Implements ETag-based caching for bandwidth optimization
   - Returns 304 Not Modified when client cache is current
   - Located in: `supabase/functions/quality-config/index.ts`

3. **Client Service** (`remote-config.ts`)
   - Zustand-backed state management for thresholds
   - MMKV-based local caching with 6-hour TTL
   - Automatic fallback to stale cache or defaults on network errors
   - Located in: `src/lib/quality/remote-config.ts`

4. **Quality Engine** (`engine.ts`)
   - Reads thresholds from MMKV via `getQualityThresholds()`
   - Analyzes photos using blur, exposure, white balance, and composition metrics
   - Located in: `src/lib/quality/engine.ts`

### Data Flow

```
App Startup
    ↓
useRootStartup calls refreshQualityThresholds()
    ↓
remote-config checks local cache (6h TTL)
    ↓
If stale → fetch from quality-config Edge Function
    ↓
Edge Function queries quality_thresholds table
    ↓
Picks best match (platform + device tier)
    ↓
Returns config with ETag header
    ↓
Client caches to MMKV (both remote cache + thresholds)
    ↓
Quality engine reads from MMKV when assessing photos
```

## Configuration Schema

### Database Row

```sql
CREATE TABLE quality_thresholds (
  id uuid PRIMARY KEY,
  platform quality_platform_enum NOT NULL DEFAULT 'universal',
  device_tier text,
  blur_min_variance double precision NOT NULL,
  blur_severe_variance double precision NOT NULL,
  blur_weight double precision NOT NULL,
  exposure_under_max_ratio double precision NOT NULL,
  exposure_over_max_ratio double precision NOT NULL,
  exposure_range_min double precision NOT NULL,
  exposure_range_max double precision NOT NULL,
  exposure_weight double precision NOT NULL,
  white_balance_max_deviation double precision NOT NULL,
  white_balance_severe_deviation double precision NOT NULL,
  white_balance_weight double precision NOT NULL,
  composition_min_plant_coverage double precision NOT NULL,
  composition_min_center_coverage double precision NOT NULL,
  composition_weight double precision NOT NULL,
  acceptable_score integer NOT NULL,
  borderline_score integer NOT NULL,
  version integer NOT NULL DEFAULT 1,
  rollout_percentage integer NOT NULL DEFAULT 100,
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### Client Response

```typescript
{
  thresholds: {
    blur: {
      minVariance: number;
      severeVariance: number;
      weight: number;
    };
    exposure: {
      underExposureMaxRatio: number;
      overExposureMaxRatio: number;
      acceptableRange: [number, number];
      weight: number;
    };
    whiteBalance: {
      maxDeviation: number;
      severeDeviation: number;
      weight: number;
    };
    composition: {
      minPlantCoverage: number;
      minCenterCoverage: number;
      weight: number;
    };
    acceptableScore: number;
    borderlineScore: number;
  };
  version: number;
  updatedAt: string;
  rolloutPercentage?: number;
  etag?: string;
}
```

## Device Tier Detection

Device tiers are determined using `expo-constants` `deviceYearClass`:

- **low**: ≤ 2016
- **mid**: 2017-2020
- **high**: 2021+

This allows tuning thresholds for device capabilities (e.g., lower-end devices may have noisier camera sensors requiring adjusted blur thresholds).

## Platform Targeting

Supported platforms:

- `ios`
- `android`
- `universal` (fallback for all platforms)

The Edge Function prioritizes platform-specific configs over universal ones.

## Caching Strategy

### Client-Side Cache

- **Storage**: MMKV (`quality.remote-config.cache.v1`)
- **TTL**: 6 hours
- **Invalidation**: Platform or device tier mismatch
- **ETag Support**: Sends `If-None-Match` header on subsequent requests

### Edge Function Cache

- **Cache-Control**: `private, max-age=300` (5 minutes)
- **Vary**: `Authorization, X-App-Platform, X-Device-Tier`
- **ETag**: `{row_id}:{updated_at}`

### Fallback Hierarchy

1. Fresh cache (< 6 hours, matching platform/tier)
2. Remote fetch from Edge Function
3. 304 Not Modified → use existing cache
4. Stale cache (on network error)
5. Hardcoded defaults

## Usage

### Fetching Thresholds

```typescript
import { refreshQualityThresholds } from '@/lib/quality/remote-config';

// Automatic on app startup via useRootStartup
await refreshQualityThresholds();

// Force refresh (bypass cache)
await refreshQualityThresholds({ force: true });
```

### Reading Thresholds in Components

```typescript
import { useQualityThresholds } from '@/lib/quality/remote-config';

function MyComponent() {
  const { thresholds, status, error, metadata } = useQualityThresholds();

  if (status === 'loading') return <Spinner />;
  if (status === 'error') return <ErrorMessage error={error} />;

  // Use thresholds...
}
```

### Reading Thresholds in Non-React Code

```typescript
import { getQualityThresholds } from '@/lib/quality/config';

// Reads from MMKV (updated by remote-config)
const thresholds = getQualityThresholds();
```

## Deployment Workflow

### 1. Create New Threshold Configuration

```sql
INSERT INTO quality_thresholds (
  platform,
  device_tier,
  blur_min_variance,
  blur_severe_variance,
  blur_weight,
  exposure_under_max_ratio,
  exposure_over_max_ratio,
  exposure_range_min,
  exposure_range_max,
  exposure_weight,
  white_balance_max_deviation,
  white_balance_severe_deviation,
  white_balance_weight,
  composition_min_plant_coverage,
  composition_min_center_coverage,
  composition_weight,
  acceptable_score,
  borderline_score,
  version,
  rollout_percentage
) VALUES (
  'android',
  'low',
  80,  -- Lower blur threshold for older devices
  50,
  0.35,
  0.20,
  0.20,
  0.25,
  0.75,
  0.25,
  0.15,
  0.25,
  0.2,
  0.35,
  0.20,
  0.2,
  70,  -- Lower acceptable score
  55,
  2,
  100
);
```

### 2. Gradual Rollout (Optional)

Set `rollout_percentage` to control exposure:

```sql
UPDATE quality_thresholds
SET rollout_percentage = 10
WHERE id = '<config-id>';
```

Increase gradually: 10% → 25% → 50% → 100%

### 3. Monitor Impact

- Check Sentry for quality-related errors
- Monitor photo rejection rates in analytics
- Gather user feedback on false positives/negatives

### 4. Rollback if Needed

```sql
-- Revert to previous version
UPDATE quality_thresholds
SET rollout_percentage = 0
WHERE version = 2;

UPDATE quality_thresholds
SET rollout_percentage = 100
WHERE version = 1;
```

## Testing

### Unit Tests

Located in: `src/lib/quality/remote-config.test.ts`

Run tests:

```bash
pnpm test remote-config
```

### Manual Testing

1. **Fresh Install**: Clear app data, verify defaults are used
2. **Network Fetch**: Launch app with network, verify remote config loads
3. **Cache Hit**: Relaunch within 6 hours, verify no network request
4. **Stale Cache**: Wait 7 hours, verify refresh fetches new config
5. **Offline**: Disable network, verify stale cache is used
6. **Force Refresh**: Call with `{ force: true }`, verify cache bypassed

### Edge Function Testing

```bash
# Local Supabase
supabase functions serve quality-config

# Test request
curl -X POST http://localhost:54321/functions/v1/quality-config \
  -H "Authorization: Bearer <anon-key>" \
  -H "X-App-Platform: ios" \
  -H "X-Device-Tier: high"
```

## Monitoring

### Key Metrics

- **Cache Hit Rate**: Percentage of requests served from cache
- **Fetch Latency**: Time to fetch from Edge Function
- **Error Rate**: Failed fetches requiring fallback
- **Config Version Distribution**: Which versions are active in the field

### Logging

The service logs to console with `[QualityRemoteConfig]` prefix:

- Cache read/write failures
- Network fetch errors
- Invalid payload warnings

## Security Considerations

- **Authentication**: Edge Function requires valid Supabase JWT
- **Authorization**: RLS policies ensure users can only read configs
- **Input Validation**: Zod schemas validate all payloads
- **Rate Limiting**: Supabase Edge Functions have built-in rate limits

## Performance Impact

- **Startup Overhead**: ~50-200ms for cache read or ~300-800ms for network fetch
- **Memory**: ~2KB for cached config
- **Storage**: ~3KB MMKV (thresholds + remote cache)
- **Network**: ~1.5KB per fetch (gzipped)

## Future Enhancements

- [ ] A/B testing framework with user bucketing
- [ ] Analytics integration for threshold effectiveness
- [ ] Admin UI for config management
- [ ] Automatic rollback on error rate spike
- [ ] Per-strain or per-setup threshold overrides
- [ ] Machine learning-based threshold optimization

## Troubleshooting

### Config Not Updating

1. Check network connectivity
2. Verify cache TTL hasn't expired yet (force refresh)
3. Check Supabase Edge Function logs
4. Verify database row exists and matches platform/tier

### Using Wrong Thresholds

1. Check `metadata.source` in `useQualityThresholds()`
2. Verify MMKV storage key hasn't been corrupted
3. Clear app data and reinstall

### Edge Function Errors

1. Check Supabase logs: `supabase functions logs quality-config`
2. Verify database connection and RLS policies
3. Test with curl to isolate client vs server issues

## Related Documentation

- [Quality Assessment Engine](./quality-engine.md)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [MMKV Storage](https://github.com/mrousavy/react-native-mmkv)
