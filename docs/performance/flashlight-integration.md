# Flashlight Integration for Automated FPS Capture

[Flashlight](https://github.com/bamlab/flashlight) is a performance profiling tool that integrates with Maestro to automatically capture FPS metrics during test execution.

## Overview

Flashlight provides:

- **Automated FPS capture** during Maestro tests
- **Real-time performance metrics** (CPU, memory, FPS)
- **Visual performance reports** with charts and graphs
- **CI/CD integration** for automated performance monitoring
- **Comparison reports** between test runs

## Installation

### Prerequisites

- Node.js 18+
- Maestro CLI installed
- Android SDK (for Android testing)
- Xcode (for iOS testing)

### Install Flashlight

```bash
# Install globally
npm install -g @perf-profiler/profiler

# Or install as dev dependency
pnpm add -D @perf-profiler/profiler

# Verify installation
flashlight --version
```

## Basic Usage

### Running Performance Tests with Flashlight

```bash
# Android
flashlight test \
  --bundleId com.obytes.production \
  --testCommand "maestro test .maestro/performance/agenda-scroll-performance.yaml" \
  --resultsFilePath ./performance-results.json

# iOS
flashlight test \
  --bundleId com.obytes.production \
  --testCommand "maestro test .maestro/performance/agenda-scroll-performance.yaml" \
  --resultsFilePath ./performance-results.json \
  --platform ios
```

### Output

Flashlight generates:

- **JSON report** with detailed metrics
- **HTML report** with interactive charts
- **Performance score** (0-100)
- **FPS timeline** graph
- **CPU/Memory usage** graphs

## Integration with Maestro Tests

### Test Configuration

Add Flashlight metadata to your Maestro tests:

```yaml
# .maestro/performance/agenda-scroll-performance.yaml
appId: ${APP_ID}
tags:
  - performance
  - flashlight # Tag for Flashlight filtering
---
# Your test steps here
```

### Running Multiple Tests

```bash
# Run all performance tests with Flashlight
flashlight test \
  --bundleId com.obytes.production \
  --testCommand "maestro test .maestro/performance/ --include-tags performance" \
  --resultsFilePath ./performance-results.json
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Performance Tests

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: |
          npm install -g @perf-profiler/profiler
          curl -Ls 'https://get.maestro.mobile.dev' | bash

      - name: Setup Android Emulator
        uses: reactivecircus/android-emulator-runner@v2
        with:
          api-level: 33
          target: google_apis
          arch: x86_64
          profile: pixel_6a

      - name: Build Release APK
        run: |
          pnpm run build:production:android

      - name: Run Performance Tests
        run: |
          flashlight test \
            --bundleId com.obytes.production \
            --testCommand "maestro test .maestro/performance/" \
            --resultsFilePath ./performance-results.json

      - name: Upload Performance Report
        uses: actions/upload-artifact@v3
        with:
          name: performance-report
          path: |
            ./performance-results.json
            ./performance-report.html

      - name: Check Performance Budgets
        run: |
          node scripts/ci/check-performance-budgets.js ./performance-results.json
```

## Performance Budgets with Flashlight

### Define Budgets

Create a configuration file:

```json
// flashlight.config.json
{
  "budgets": {
    "fps": {
      "average": 58,
      "p95": 55
    },
    "cpu": {
      "average": 60,
      "p95": 80
    },
    "memory": {
      "average": 200,
      "p95": 300
    }
  },
  "thresholds": {
    "fps": {
      "error": 55,
      "warning": 57
    }
  }
}
```

### Budget Validation Script

```javascript
// scripts/ci/check-performance-budgets.js
const fs = require('fs');

const results = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const budgets = require('../../flashlight.config.json').budgets;

let failed = false;

// Check FPS budget
if (results.averageFps < budgets.fps.average) {
  console.error(
    `❌ Average FPS (${results.averageFps}) below budget (${budgets.fps.average})`
  );
  failed = true;
}

// Check CPU budget
if (results.averageCpu > budgets.cpu.average) {
  console.error(
    `❌ Average CPU (${results.averageCpu}%) above budget (${budgets.cpu.average}%)`
  );
  failed = true;
}

// Check Memory budget
if (results.averageMemory > budgets.memory.average) {
  console.error(
    `❌ Average Memory (${results.averageMemory}MB) above budget (${budgets.memory.average}MB)`
  );
  failed = true;
}

if (failed) {
  process.exit(1);
}

console.log('✅ All performance budgets passed!');
```

## Advanced Features

### Comparing Test Runs

```bash
# Run baseline test
flashlight test \
  --bundleId com.obytes.production \
  --testCommand "maestro test .maestro/performance/agenda-scroll-performance.yaml" \
  --resultsFilePath ./baseline.json

# Run comparison test (after changes)
flashlight test \
  --bundleId com.obytes.production \
  --testCommand "maestro test .maestro/performance/agenda-scroll-performance.yaml" \
  --resultsFilePath ./current.json

# Generate comparison report
flashlight compare \
  --before ./baseline.json \
  --after ./current.json \
  --output ./comparison-report.html
```

### Custom Metrics

Flashlight can track custom metrics via annotations in your app:

```typescript
// In your React Native app
import { PerformanceObserver } from '@perf-profiler/react-native';

// Mark performance events
PerformanceObserver.mark('scroll-start');
// ... scrolling happens ...
PerformanceObserver.mark('scroll-end');

// Measure duration
PerformanceObserver.measure('scroll-duration', 'scroll-start', 'scroll-end');
```

### Filtering Results

```bash
# Only measure specific test scenarios
flashlight test \
  --bundleId com.obytes.production \
  --testCommand "maestro test .maestro/performance/agenda-scroll-performance.yaml" \
  --resultsFilePath ./results.json \
  --record-options '{"samplingInterval": 100}'  # Sample every 100ms
```

## Interpreting Results

### FPS Metrics

```json
{
  "averageFps": 59.2,
  "minFps": 52.1,
  "maxFps": 60.0,
  "p95Fps": 58.5,
  "droppedFrames": 12,
  "totalFrames": 1800
}
```

**Interpretation:**

- **averageFps ≥58**: ✅ Meets budget
- **p95Fps ≥55**: ✅ 95% of frames are smooth
- **droppedFrames ≤1%**: ✅ (12/1800 = 0.67%)

### CPU Metrics

```json
{
  "averageCpu": 45.2,
  "maxCpu": 78.3,
  "p95Cpu": 65.1
}
```

**Interpretation:**

- **averageCpu <60%**: ✅ Good headroom
- **maxCpu <80%**: ✅ No sustained spikes
- **p95Cpu <70%**: ✅ Consistent performance

### Memory Metrics

```json
{
  "averageMemory": 185.4,
  "maxMemory": 235.2,
  "memoryDelta": 48.7
}
```

**Interpretation:**

- **averageMemory <200MB**: ✅ Within budget
- **memoryDelta <50MB**: ✅ No significant leaks
- **maxMemory <300MB**: ✅ Peak usage acceptable

## Troubleshooting

### Flashlight Not Capturing Metrics

1. **Check device connection**:

   ```bash
   adb devices  # Android
   xcrun simctl list  # iOS
   ```

2. **Verify app is running**:

   ```bash
   adb shell pidof com.obytes.production  # Should return PID
   ```

3. **Check Flashlight logs**:
   ```bash
   flashlight test --verbose ...
   ```

### Inconsistent Results

1. **Use release builds**: Dev builds have different performance
2. **Close background apps**: Other processes affect metrics
3. **Disable animations** (optional): For more consistent timing
4. **Run multiple iterations**: Average results across 3-5 runs

### High CPU/Memory Usage

1. **Check for memory leaks**: Use Perfetto traces
2. **Profile with React DevTools**: Identify expensive renders
3. **Review Reanimated worklets**: Ensure proper optimization
4. **Check image loading**: Verify thumbnail usage

## Best Practices

### Test Design

1. **Isolate scenarios**: Test one feature at a time
2. **Use synthetic data**: Ensure consistent test conditions
3. **Warm up the app**: Run a quick scroll before measuring
4. **Measure steady state**: Skip initial load time

### Result Analysis

1. **Compare against baseline**: Track trends over time
2. **Focus on P95 metrics**: More reliable than averages
3. **Investigate regressions**: >10% delta requires investigation
4. **Document anomalies**: Note any unusual results

### CI Integration

1. **Run on physical devices**: More accurate than emulators
2. **Use consistent hardware**: Same device model for all tests
3. **Set strict budgets**: Fail builds on regressions
4. **Archive results**: Keep historical data for trends

## Integration with Existing Tools

### Combining with Perfetto

```bash
# Start Perfetto trace
adb shell perfetto -c - --txt -o /data/misc/perfetto-traces/trace.pb &

# Run Flashlight test
flashlight test \
  --bundleId com.obytes.production \
  --testCommand "maestro test .maestro/performance/agenda-scroll-performance.yaml" \
  --resultsFilePath ./flashlight-results.json

# Pull Perfetto trace
adb pull /data/misc/perfetto-traces/trace.pb ./perfetto-trace.pb

# Now you have both Flashlight metrics and Perfetto trace for deep analysis
```

### Combining with Sentry

```typescript
// In your app, send Flashlight metrics to Sentry
import * as Sentry from '@sentry/react-native';

function reportPerformanceMetrics(metrics: FlashlightMetrics) {
  Sentry.addBreadcrumb({
    category: 'performance',
    message: 'Flashlight metrics',
    level: 'info',
    data: {
      averageFps: metrics.averageFps,
      averageCpu: metrics.averageCpu,
      averageMemory: metrics.averageMemory,
    },
  });
}
```

## Additional Resources

- [Flashlight Documentation](https://github.com/bamlab/flashlight)
- [Maestro + Flashlight Guide](https://maestro.mobile.dev/advanced/performance-testing)
- [Performance Profiling Best Practices](https://reactnative.dev/docs/profiling)
- [Android Performance Profiling](https://developer.android.com/topic/performance/profiling)
