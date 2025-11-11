# Performance Trend Analysis

This document describes the performance trend analysis system that monitors performance metrics over time and detects regressions automatically.

## Overview

The trend analysis system implements a 7-day moving average baseline for performance metrics and alerts when current values deviate by more than 10% from the baseline. This helps catch performance regressions before they reach production.

## Architecture

### Components

1. **Sentry Dashboard Configuration** (`src/lib/performance/sentry-dashboard-config.ts`)
   - Defines dashboard IDs for each performance category
   - Configures alert thresholds
   - Provides dashboard URL generation

2. **Trend Analysis Engine** (`src/lib/performance/trend-analysis.ts`)
   - Calculates 7-day moving averages
   - Computes percentage deltas
   - Detects threshold violations
   - Groups and filters metrics

3. **Time Series Uploader** (`src/lib/performance/time-series-uploader.ts`)
   - Uploads metrics to Sentry
   - Batches uploads for efficiency
   - Handles retries and errors

4. **CI Trend Validator** (`scripts/ci/performance-trend-validator.js`)
   - Fetches historical metrics from Sentry
   - Analyzes trends for current build
   - Fails CI on regressions >10%

## Configuration

### Environment Variables

Required for trend analysis:

```bash
# Sentry Configuration
SENTRY_AUTH_TOKEN=<your-sentry-auth-token>
SENTRY_ORG=<your-org-slug>
SENTRY_PROJECT=<your-project-slug>

# Dashboard IDs (optional, created in Sentry UI)
SENTRY_DASHBOARD_STARTUP=<dashboard-id>
SENTRY_DASHBOARD_NAVIGATION=<dashboard-id>
SENTRY_DASHBOARD_SCROLL=<dashboard-id>
SENTRY_DASHBOARD_SYNC=<dashboard-id>

# Trend Analysis Settings
TREND_WINDOW_DAYS=7        # Moving average window (default: 7)
TREND_THRESHOLD=0.1        # Regression threshold (default: 0.1 = 10%)
MIN_DATA_POINTS=3          # Minimum data points required (default: 3)
```

### Sentry Dashboard Setup

1. **Create Dashboards in Sentry**:
   - Navigate to Dashboards in Sentry UI
   - Create separate dashboards for: Startup, Navigation, Scroll, Sync
   - Add relevant widgets for each category

2. **Configure Dashboard IDs**:
   - Copy dashboard IDs from Sentry URLs
   - Set environment variables in `.env` files
   - Dashboard IDs are optional; trend analysis works without them

3. **Set Up Alerts** (optional):
   - Configure Sentry alerts for threshold violations
   - Use metric alert rules for automated notifications

## Metrics Tracked

### Startup Metrics

- `startup.tti` - Time to Interactive (ms)
- `startup.ttfd` - Time to First Display (ms)

### Navigation Metrics

- `navigation.p95` - 95th percentile transition time (ms)
- `navigation.avg` - Average transition time (ms)

### Scroll Metrics

- `scroll.avgFps` - Average frames per second
- `scroll.p95FrameTime` - 95th percentile frame time (ms)
- `scroll.droppedFramesPct` - Percentage of dropped frames
- `scroll.jankCount` - Number of jank events

### Sync Metrics

- `sync.p95` - 95th percentile sync time (ms)
- `sync.avg` - Average sync time (ms)

## CI Integration

### Workflow

The trend analysis runs automatically on `main` branch commits:

1. **Performance tests execute** (Maestro/Detox)
2. **Budget validation runs** (hard fail on budget violations)
3. **Trend analysis executes** (non-blocking, logs warnings)
4. **Artifacts uploaded** (includes trend report)

### Trend Analysis Steps

```yaml
- name: Analyze Performance Trends
  if: always() && github.ref == 'refs/heads/main'
  env:
    SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
    SENTRY_ORG: ${{ secrets.SENTRY_ORG }}
    SENTRY_PROJECT: ${{ secrets.SENTRY_PROJECT }}
    BUILD_HASH: ${{ github.sha }}
    PLATFORM: android
    DEVICE_MODEL: Pixel 6a Emulator
    PERFORMANCE_REPORT_PATH: maestro-results/performance-report.json
  run: |
    node scripts/ci/performance-trend-validator.js || echo "Trend analysis failed (non-blocking)"
```

### Output

The trend validator generates a JSON report:

```json
{
  "timestamp": "2025-01-08T10:00:00.000Z",
  "buildHash": "abc123",
  "platform": "android",
  "device": "Pixel 6a Emulator",
  "config": {
    "windowDays": 7,
    "threshold": 0.1,
    "minDataPoints": 3
  },
  "results": [
    {
      "metric": "startup.tti",
      "currentValue": 1500,
      "movingAverage": 1400,
      "delta": 0.071,
      "exceedsThreshold": false,
      "dataPoints": 10
    }
  ],
  "hasRegressions": false
}
```

## Usage

### Local Development

```typescript
import {
  analyzeTrend,
  calculateMovingAverage,
  type PerformanceTimeSeriesPoint,
} from '@/lib/performance';

// Historical data points
const dataPoints: PerformanceTimeSeriesPoint[] = [
  {
    timestamp: Date.now() - 6 * 24 * 60 * 60 * 1000,
    metric: 'startup.tti',
    value: 1400,
    buildHash: 'abc',
    device: 'Pixel 6a',
    platform: 'android',
  },
  // ... more points
];

// Analyze trend
const result = analyzeTrend(dataPoints, 1500);

if (result.exceedsThreshold) {
  console.warn(`Regression detected: ${result.metric}`);
  console.warn(`Current: ${result.currentValue}ms`);
  console.warn(`Baseline: ${result.movingAverage}ms`);
  console.warn(`Delta: ${(result.delta * 100).toFixed(1)}%`);
}
```

### Uploading Metrics

```typescript
import { uploadCIMetrics } from '@/lib/performance';

// Upload metrics from CI
const metrics = new Map([
  ['startup.tti', 1500],
  ['scroll.avgFps', 58],
  ['navigation.p95', 200],
]);

const result = await uploadCIMetrics(
  metrics,
  'abc123', // build hash
  'Pixel 6a',
  'android'
);

console.log(`Uploaded ${result.pointsUploaded} metrics`);
```

## Thresholds and Budgets

### Regression Threshold

- **Default**: 10% (0.1)
- **Configurable**: via `TREND_THRESHOLD` environment variable
- **Applies to**: All metrics uniformly

### Budget vs Trend

- **Budgets**: Hard limits (CI fails immediately)
- **Trends**: Soft limits (warns, non-blocking)

Example:

- Budget: Startup TTI ≤1.8s (hard fail)
- Trend: Startup TTI increased >10% from 7-day average (warning)

## Troubleshooting

### Insufficient Data Points

**Symptom**: Trend analysis skipped for metrics

**Solution**:

- Wait for more CI runs to accumulate data
- Reduce `MIN_DATA_POINTS` (not recommended below 3)
- Check Sentry data retention settings

### Sentry API Errors

**Symptom**: Failed to fetch historical metrics

**Solutions**:

- Verify `SENTRY_AUTH_TOKEN` has correct permissions
- Check Sentry API rate limits
- Ensure `SENTRY_ORG` and `SENTRY_PROJECT` are correct

### False Positives

**Symptom**: Trend analysis reports regressions for valid changes

**Solutions**:

- Adjust `TREND_THRESHOLD` if too sensitive
- Increase `TREND_WINDOW_DAYS` for more stable baseline
- Review device-specific budgets (different devices have different baselines)

## Best Practices

1. **Monitor Dashboards Regularly**: Check Sentry dashboards weekly for trends
2. **Investigate Warnings**: Don't ignore trend warnings even if CI passes
3. **Update Baselines**: After intentional performance changes, expect trend warnings
4. **Device-Specific Analysis**: Compare metrics within same device family
5. **Combine with Profiling**: Use Perfetto traces to investigate regressions

## References

- [Sentry Performance Monitoring](https://docs.sentry.io/product/performance/)
- [Performance Budgets Workflow](../../.github/workflows/performance-budgets.yml)
- [Performance Validation Script](../../scripts/ci/performance-validation.js)
- [Design Document](../../.kiro/specs/21.%20performance-and-reliability/design.md)
