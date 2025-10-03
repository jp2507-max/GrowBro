# Strains Feature Analytics & Performance Monitoring

This document describes the analytics and performance monitoring implementation for the strains feature.

## Analytics Events

### User Interaction Events

#### `strain_search`

Tracks search queries with filters and results.

**Payload:**

```typescript
{
  query?: string;              // Raw search query (sanitized before sending)
  sanitized_query?: string;    // PII-stripped query
  results_count: number;       // Number of results returned
  filters_applied?: string[];  // Array of filter types applied
  sort_by?: string;           // Sort field if any
  is_offline: boolean;        // Whether search was from cache
  response_time_ms?: number;  // API response time
}
```

**Usage:**

```typescript
import { useAnalytics } from '@/lib/use-analytics';
import { trackStrainSearch } from '@/lib/strains/strains-analytics';

const analytics = useAnalytics();
trackStrainSearch(analytics, {
  query: 'og kush',
  resultsCount: 15,
  filters: { race: 'hybrid' },
  isOffline: false,
  responseTimeMs: 234,
});
```

#### `strain_filter_applied`

Tracks individual filter applications.

**Payload:**

```typescript
{
  filter_type: 'race' | 'effects' | 'flavors' | 'difficulty' | 'thc' | 'cbd';
  filter_value: string;
  results_count: number;
}
```

#### `strain_detail_viewed`

Tracks strain detail page views.

**Payload:**

```typescript
{
  strain_id: string;
  strain_name?: string;
  race?: string;
  source: 'list' | 'search' | 'favorites' | 'deep_link';
  is_offline: boolean;
}
```

**Usage with Hook:**

```typescript
import { useTrackStrainDetailView } from '@/lib/strains/use-strain-analytics';

useTrackStrainDetailView({
  strainId: strain.id,
  strainName: strain.name,
  race: strain.race,
  source: 'list',
  isOffline: false,
});
```

#### `strain_favorite_added` / `strain_favorite_removed`

Tracks favorite actions.

**Payload:**

```typescript
{
  strain_id: string;
  source: 'detail' | 'list' | 'favorites_screen';
  total_favorites: number;
}
```

**Note:** These events are automatically tracked by the `useFavorites` store.

#### `strain_list_scrolled`

Tracks pagination/infinite scroll.

**Payload:**

```typescript
{
  page_number: number;
  total_items_loaded: number;
  is_offline: boolean;
}
```

**Usage with Hook:**

```typescript
import { useTrackStrainListScroll } from '@/lib/strains/use-strain-analytics';

const { trackScroll } = useTrackStrainListScroll();

// In your FlashList onEndReached
trackScroll(pageNumber, totalItems, isOffline);
```

#### `strain_offline_usage`

Tracks offline usage patterns.

**Payload:**

```typescript
{
  action: 'browse' | 'search' | 'view_detail' | 'manage_favorites';
  cached_pages_available: number;
}
```

### Performance Events

#### `strain_list_performance`

Tracks FlashList rendering performance.

**Payload:**

```typescript
{
  fps: number; // Frames per second
  frame_drops: number; // Frames >32ms
  total_frames: number; // Total frames measured
  avg_frame_time_ms: number; // Average frame time
  list_size: number; // Number of items in list
}
```

**Usage with Hook:**

```typescript
import { useFlashListPerformance } from '@/lib/strains/use-flashlist-performance';

const { onScroll, startTracking, stopTracking } = useFlashListPerformance({
  listSize: data.length,
  enabled: true,
  sampleInterval: 100, // ms
});

// Start tracking when list mounts
useEffect(() => {
  startTracking();
  return () => stopTracking();
}, []);

// Track on scroll
<FlashList onScroll={onScroll} ... />
```

#### `strain_api_performance`

Tracks API response times and errors.

**Payload:**

```typescript
{
  endpoint: 'list' | 'detail';
  response_time_ms: number;
  status_code: number;
  cache_hit: boolean;
  error_type?: string;
}
```

**Note:** Automatically tracked by `StrainsApiClient`.

#### `strain_image_performance`

Tracks image loading performance.

**Payload:**

```typescript
{
  load_time_ms: number;
  cache_hit: boolean;
  image_size_kb?: number;
  failed: boolean;
}
```

**Usage with Hook:**

```typescript
import { useImagePerformanceTracking } from '@/lib/strains/use-flashlist-performance';

const { trackImageLoad } = useImagePerformanceTracking();

// In your Image component
<Image
  onLoadStart={() => setStartTime(Date.now())}
  onLoad={() => {
    trackImageLoad({
      loadTimeMs: Date.now() - startTime,
      cacheHit: false,
      failed: false,
    });
  }}
  onError={() => {
    trackImageLoad({
      loadTimeMs: Date.now() - startTime,
      cacheHit: false,
      failed: true,
    });
  }}
/>
```

#### `strain_cache_performance`

Tracks cache operations and hit rates.

**Payload:**

```typescript
{
  operation: 'read' | 'write' | 'evict';
  cache_type: 'memory' | 'disk' | 'etag';
  hit_rate?: number;  // 0 or 1 for reads
  size_kb?: number;   // For writes
}
```

**Note:** Automatically tracked by `StrainsApiClient` cache operations.

## Privacy & Consent

All strain-related analytics events require user consent via the `analytics` consent key.

**Checking Consent:**

```typescript
import { hasConsent } from '@/lib/privacy-consent';

if (hasConsent('analytics')) {
  // Track event
}
```

**Automatic Consent Gating:**
The analytics system automatically gates all `strain_*` events through `createConsentGatedAnalytics()`.

## PII Sanitization

All analytics payloads are automatically sanitized to remove PII:

- Search queries are stripped of emails, phone numbers, and truncated to 128 chars
- Strain names are truncated to 50 chars
- All identifiers use non-identifiable UUIDs

## Performance Utilities

### `FlashListPerformanceTracker`

Tracks FPS and frame drops for FlashList.

```typescript
import { FlashListPerformanceTracker } from '@/lib/strains/strains-performance';

const tracker = new FlashListPerformanceTracker();
tracker.start();
// ... record frames during scroll
tracker.recordFrame();
// ... stop and report
tracker.stop(analytics, listSize);
```

### `PerformanceTimer`

Simple timer for measuring operation duration.

```typescript
import { PerformanceTimer } from '@/lib/strains/strains-performance';

const timer = new PerformanceTimer();
timer.start();
// ... perform operation
const duration = timer.stop();
```

### `PerformanceAggregator`

Aggregates metrics over time for analysis.

```typescript
import { PerformanceAggregator } from '@/lib/strains/strains-performance';

const aggregator = new PerformanceAggregator();
aggregator.record('api_response_time', 234);
aggregator.record('api_response_time', 189);

const avg = aggregator.getAverage('api_response_time');
const p95 = aggregator.getP95('api_response_time');
```

## Testing

All analytics tracking is non-blocking and fails silently to not impact user experience.

**Testing with InMemoryMetrics:**

```typescript
import { InMemoryMetrics } from '@/lib/analytics';

const metrics = new InMemoryMetrics();
// ... perform actions
const events = metrics.getAll();
expect(events).toContainEqual({
  name: 'strain_search',
  payload: expect.objectContaining({
    results_count: 15,
  }),
});
```

## Monitoring Dashboards

Key metrics to monitor:

1. **User Engagement:**
   - Search query volume and patterns
   - Filter usage distribution
   - Detail page view rate
   - Favorite conversion rate

2. **Performance:**
   - API response times (p50, p95, p99)
   - FlashList FPS and frame drops
   - Image load times
   - Cache hit rates

3. **Offline Usage:**
   - Offline action distribution
   - Cached page availability
   - Sync success rates

4. **Errors:**
   - API error rates by type
   - Image load failure rates
   - Cache eviction frequency
