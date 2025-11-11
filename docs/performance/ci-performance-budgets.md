# CI Performance Budgets

## Overview

This document describes the automated performance budget enforcement system implemented for the GrowBro mobile application. The system ensures that performance regressions are caught before reaching production by enforcing strict performance budgets in the CI/CD pipeline.

**Requirements**: Spec 21, Task 9 - CI Performance Budgets

## Performance Budgets

All budgets are enforced in CI and will **FAIL the build** if exceeded.

### Startup Performance

**Budget**: Time to Interactive (TTI)

- **Pixel 6a / Pixel 6a Emulator**: ≤1.8s (cold start)
- **Moto G Power / Moto G Play**: ≤2.0s (cold start)
- **iPhone 12 / iPhone 12 Simulator**: ≤1.3s (cold start)
- **Unknown devices**: ≤2.0s (fallback)

**Measurement**: `@shopify/react-native-performance` + Sentry `app.startup` transaction

**Test**: `.maestro/performance/startup-performance.yaml`

### Navigation Performance

**Budget**: P95 screen transition time

- **All devices**: ≤250ms

**Measurement**: React Navigation instrumentation spans

**Test**: `.maestro/performance/navigation-performance.yaml`

### Scroll Performance

**Budget**: 30-second continuous scroll over 1,000 items

- **Average FPS**: ≥58
- **P95 frame time**: ≤16.7ms (60 FPS)
- **Dropped frames**: ≤1%
- **Jank count**: ≤5 per 1k frames
- **Blank cells**: 0 (zero tolerance)
- **Memory delta**: ≤50 MB RSS increase
- **Post-GC memory**: ≤10 MB above baseline

**Measurement**: Perfetto FrameTimeline (Android) + RN Performance JSON

**Test**: `.maestro/community/scroll-performance.yaml`

### Sync Performance

**Budget**: P95 sync time for 500 items

- **All devices**: ≤2.5s on LTE simulation

**Measurement**: Custom sync transaction spans

**Test**: `.maestro/performance/sync-performance.yaml`

## CI Workflow

### Automated Testing

The performance budget validation runs automatically on:

- **Pull requests** to `main` or `develop` branches
- **Pushes** to `main` branch
- **Manual trigger** via workflow dispatch

### Test Matrix

Tests run on both platforms with device-specific budgets:

- **Android**: Pixel 6a Emulator (Android 13)
- **iOS**: iPhone 12 Simulator (iOS 17)

Each platform runs 4 test suites:

1. Startup performance
2. Navigation performance
3. Scroll performance
4. Sync performance

### Build Requirements

**CRITICAL**: Performance tests MUST run on **release builds only**.

The CI will fail if:

- `__DEV__` is `true`
- Flipper is enabled
- Remote debugging is enabled
- Dev menu is enabled

## Running Tests Locally

### Prerequisites

```bash
# Install dependencies
pnpm install

# Install Maestro
curl -Ls "https://get.maestro.mobile.dev" | bash

# Build release version
# Android
cd android && ./gradlew assembleRelease && cd ..

# iOS
xcodebuild -workspace ios/GrowBro.xcworkspace \
  -scheme GrowBro \
  -configuration Release \
  -sdk iphonesimulator \
  -derivedDataPath ios/build
```

### Run Individual Tests

```bash
# Set required environment variables
export BUILD_TYPE=release
export PLATFORM=android
export DEVICE_MODEL="Pixel 6a Emulator"
export OS_VERSION="Android 13"
export BUILD_HASH=$(git rev-parse HEAD)
export DATASET_SIZE=1000

# Run a specific test
maestro test .maestro/performance/startup-performance.yaml

# Validate budgets
node scripts/ci/performance-validation.js
```

### Run All Performance Tests

```bash
# Android
pnpm perf:test:android

# iOS
pnpm perf:test:ios
```

## Performance Report Format

Each test generates a JSON report with the following structure:

```json
{
  "timestamp": "2025-01-08T12:00:00.000Z",
  "buildType": "release",
  "platform": "android",
  "device": "Pixel 6a Emulator",
  "os": "Android 13",
  "buildHash": "abc123...",
  "commit": "abc123...",
  "datasetSize": "1000",
  "metrics": {
    "memory": {
      "baselineRSS": 150,
      "peakRSS": 195,
      "postGCRSS": 158
    },
    "fps": {
      "avgFps": 59.2,
      "p95FrameTime": 15.8,
      "droppedFramesPct": 0.5,
      "jankCount": 3
    },
    "startup": {
      "tti": 1650,
      "threshold": 1800,
      "device": "Pixel 6a Emulator"
    },
    "navigation": {
      "p95TransitionMs": 220
    },
    "sync": {
      "syncP95Ms": 2100,
      "itemCount": 500
    },
    "perfetto": {
      "tracePath": "perfetto-trace.pb",
      "sizeMB": 12.5
    }
  },
  "budgets": {
    "scroll": { ... },
    "startup": { ... },
    "navigation": { ... },
    "sync": { ... }
  },
  "passed": true
}
```

## Artifacts

Each test run produces the following artifacts:

### Android

- **Maestro test results**: JUnit XML format
- **RN Performance JSON**: Detailed performance metrics
- **Perfetto trace**: Binary protobuf file for frame analysis
- **Performance report**: JSON summary with budget validation

### iOS

- **Maestro test results**: JUnit XML format
- **RN Performance JSON**: Detailed performance metrics
- **Performance report**: JSON summary with budget validation

### Viewing Artifacts

**Perfetto traces** (Android only):

1. Download `perfetto-trace-*.pb` from CI artifacts
2. Open [Perfetto UI](https://ui.perfetto.dev)
3. Upload the trace file
4. Analyze frame timeline, jank, and memory usage

**RN Performance JSON**:

- Contains detailed render spans, TTI, TTFD metrics
- Can be visualized with custom tooling

## Troubleshooting

### Test Failures

**Budget exceeded**:

1. Check the performance report in CI artifacts
2. Download Perfetto trace (Android) to identify bottlenecks
3. Review RN Performance JSON for detailed metrics
4. Compare against baseline from `main` branch

**Flaky tests**:

- Tests automatically retry up to 2 times on failure
- If consistently failing, check for:
  - Emulator/simulator performance issues
  - Network throttling configuration
  - Test data seeding problems

### Local Testing Issues

**"Performance tests MUST run on release builds only"**:

- Ensure `BUILD_TYPE=release` is set
- Verify you're using a release build (not debug)
- Check that dev tools are disabled

**Missing metrics**:

- Verify RN Performance instrumentation is enabled
- Check that Sentry is configured (optional)
- Ensure test data is properly seeded

## Budget Adjustments

Budget thresholds are defined in `scripts/ci/performance-validation.js`.

**To adjust budgets**:

1. Update the `BUDGETS` object in the validation script
2. Document the reason for the change
3. Get approval from the team
4. Update this documentation

**Device-specific budgets**:

- Add new devices to `BUDGETS.startup.ttiThresholds`
- Use conservative thresholds for lower-end devices
- Test on physical devices when possible

## Integration with Sentry

Performance metrics are optionally uploaded to Sentry for trend analysis:

- **7-day moving average**: Tracks performance trends over time
- **Regression detection**: >10% delta triggers investigation (not hard fail)
- **Dashboards**: Startup, Navigation, Scroll, Sync metrics
- **Alerting**: Automated alerts for budget violations

**Configuration**:

```bash
export SENTRY_ORG=your-org
export SENTRY_PROJECT=your-project
```

## Best Practices

1. **Always test on release builds** - Dev builds have different performance characteristics
2. **Use consistent test data** - Seed the same dataset for reproducible results
3. **Monitor trends** - Don't just look at pass/fail, track metrics over time
4. **Investigate warnings** - Even if tests pass, investigate performance degradation
5. **Update baselines** - When making intentional performance improvements, update budgets
6. **Document changes** - Always document why budgets were adjusted

## Related Documentation

- [Performance Testing Guide](./image-optimization-visual-qa.md)
- [Reanimated Worklets Optimization](../../.windsurf/rules/styling-guidelines.md)
- [FlashList v2 Implementation](../architecture/data-flow.md)
- [Performance Monitoring Setup](./performance-monitoring.md)

## Support

For questions or issues with performance budgets:

1. Check CI logs and artifacts
2. Review this documentation
3. Consult the team's performance expert
4. Open an issue with performance report attached
