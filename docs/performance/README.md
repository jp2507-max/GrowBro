# Performance Testing & Optimization

This directory contains documentation and tools for performance testing and optimization in the GrowBro mobile app.

## 📋 Overview

Performance testing ensures the app meets strict SLAs for scroll performance, memory usage, and user experience across target devices (Pixel 6a, Moto G Play, iPhone 12).

**Key Performance SLAs**:

- **Scroll Performance**: Avg FPS ≥58, P95 frame time ≤16.7ms, dropped frames ≤1%
- **Memory Budget**: ≤50 MB RSS increase during scroll, ≤10 MB post-GC
- **Visual Quality**: 0 blank cells, smooth placeholder transitions
- **Build Requirement**: All performance tests MUST run on **release builds only**

## 🗂️ Documentation

### [Image Optimization Visual QA](./image-optimization-visual-qa.md)

Comprehensive manual testing checklist for validating image optimization in community feeds and list views. Includes:

- 60+ acceptance criteria
- Placeholder behavior testing (BlurHash/ThumbHash)
- Dark mode testing
- Network condition testing (slow 3G, offline)
- Memory & performance validation
- Edge case handling
- Design review sign-off template

**When to use**: Before releasing any changes to image handling, list rendering, or cache management.

### [Community Performance Testing](../community-performance-testing.md)

Automated and manual performance testing strategies for the Community Feed feature.

## 🧪 Automated Performance Tests

### Maestro Scroll Performance Test

**Location**: `.maestro/community/scroll-performance.yaml`

**What it tests**:

- 30-second continuous scroll through 1000+ posts
- Bidirectional scrolling (up/down)
- Rapid scroll stress test
- Post-scroll responsiveness

**How to run locally**:

```bash
# 1. Build release APK/IPA
pnpm run build:android:release
# or
pnpm run build:ios:release

# 2. Install on device/emulator
adb install android/app/build/outputs/apk/release/app-release.apk

# 3. Seed test database (TODO: create seeding script)
# pnpm run test:seed-community --posts=1000 --images=mixed

# 4. Run Maestro test
maestro test .maestro/community/scroll-performance.yaml
```

**With Perfetto trace (Android only)**:

```bash
# 1. Start Perfetto trace collection
adb shell perfetto -c - --txt -o /data/misc/perfetto-traces/trace <<EOF
buffers: { size_kb: 63488 }
data_sources: {
  config {
    name: "linux.ftrace"
    ftrace_config {
      atrace_apps: "com.growbro.app"
      atrace_categories: "gfx"
      atrace_categories: "view"
    }
  }
}
duration_ms: 60000
EOF

# 2. Run test (in another terminal)
maestro test .maestro/community/scroll-performance.yaml

# 3. Pull trace
adb pull /data/misc/perfetto-traces/trace perfetto-trace.pb

# 4. Open in Perfetto UI
# Upload perfetto-trace.pb to https://ui.perfetto.dev
```

### CI Performance Validation

**Location**: `scripts/ci/performance-validation.js`

**What it does**:

- Validates tests run on release builds only (fails if `__DEV__` is true)
- Parses RN Performance JSON reports
- Parses Perfetto traces (Android)
- Validates metrics against budgets
- Generates performance report
- Uploads metrics to Sentry (optional)

**Environment Variables**:

```bash
BUILD_TYPE=release              # Required: must be 'release'
PLATFORM=android                # android or ios
DEVICE_MODEL="Pixel 6a"         # Device name for reporting
OS_VERSION="Android 13"         # OS version for reporting
BUILD_HASH=$GITHUB_SHA          # Git commit hash
DATASET_SIZE=1000               # Number of posts in test dataset

MAESTRO_OUTPUT_DIR=./maestro-results
PERFETTO_TRACE_PATH=./perfetto-trace.pb
RN_PERF_JSON_PATH=./rn-performance.json

SENTRY_ORG=your-org             # Optional: for metric upload
SENTRY_PROJECT=your-project     # Optional: for metric upload
```

**How to run**:

```bash
# After running Maestro tests
BUILD_TYPE=release \
PLATFORM=android \
DEVICE_MODEL="Pixel 6a" \
OS_VERSION="Android 13" \
BUILD_HASH=$(git rev-parse HEAD) \
DATASET_SIZE=1000 \
node scripts/ci/performance-validation.js
```

### GitHub Actions Workflow

**Location**: `.github/workflows/performance-tests.yml`

**Triggers**:

- Pull requests to `main` or `develop`
- Push to `main`
- Manual workflow dispatch

**What it does**:

1. Builds release APK/IPA
2. Starts emulator/simulator
3. Seeds test database
4. Collects Perfetto trace (Android)
5. Runs Maestro performance tests
6. Validates performance budgets
7. Uploads artifacts (Maestro results, Perfetto trace, RN Performance JSON)
8. Comments on PR with results

**Manual trigger**:

```bash
# Via GitHub UI: Actions → Performance Tests → Run workflow
# Or via GitHub CLI:
gh workflow run performance-tests.yml -f platform=android
```

## 📊 Performance Budgets

All budgets are defined in `scripts/ci/performance-validation.js`:

```javascript
const BUDGETS = {
  scroll: {
    avgFps: 58, // Average FPS ≥58
    p95FrameTime: 16.7, // P95 frame time ≤16.7ms
    droppedFramesPct: 1, // Dropped frames ≤1%
    blankCells: 0, // Zero blank cells
    memoryDeltaMB: 50, // RSS increase ≤50 MB
    memoryPostGCMB: 10, // Post-GC delta ≤10 MB
  },
};
```

**CI will fail if any budget is exceeded.**

## 🔧 Local Performance Profiling

### Android (Perfetto)

```bash
# 1. Start trace
adb shell perfetto -c - --txt -o /data/misc/perfetto-traces/trace <<EOF
buffers: { size_kb: 63488 }
data_sources: {
  config {
    name: "linux.ftrace"
    ftrace_config {
      atrace_apps: "com.growbro.app"
      atrace_categories: "gfx"
      atrace_categories: "view"
      atrace_categories: "input"
    }
  }
}
duration_ms: 60000
EOF

# 2. Use the app (scroll, interact, etc.)

# 3. Pull trace
adb pull /data/misc/perfetto-traces/trace perfetto-trace.pb

# 4. Analyze
# Upload to https://ui.perfetto.dev
# Look for:
# - Frame timeline (target: ≤16.7ms per frame)
# - Jank events (target: ≤5 per 1k frames)
# - Input latency (target: ≤50ms)
```

### iOS (Instruments)

```bash
# 1. Open Xcode → Instruments
# 2. Select "Time Profiler" or "Allocations"
# 3. Attach to GrowBro app
# 4. Record while using the app
# 5. Export trace for analysis
```

### Memory Profiling

**Android**:

```bash
# Monitor memory in real-time
adb shell dumpsys meminfo com.growbro.app

# Or use Android Profiler in Android Studio
```

**iOS**:

```bash
# Use Xcode Instruments → Allocations
# Look for:
# - Memory leaks
# - Retained objects
# - Peak memory usage
```

## 📝 Performance Testing Checklist

Before releasing changes that affect performance:

- [ ] Run automated Maestro scroll test on release build
- [ ] Validate all budgets pass (FPS, memory, blank cells)
- [ ] Collect Perfetto trace (Android) or Instruments trace (iOS)
- [ ] Complete manual Visual QA checklist
- [ ] Test on all target devices (Pixel 6a, Moto G Play, iPhone 12)
- [ ] Test on slow network (3G simulation)
- [ ] Test in dark mode
- [ ] Get design review sign-off
- [ ] Attach performance artifacts to PR

## 🚨 Troubleshooting

### "Performance tests MUST run on release builds only"

**Cause**: Test detected `__DEV__` is true or build type is not 'release'.

**Fix**:

```bash
# Set BUILD_TYPE environment variable
export BUILD_TYPE=release

# Build with release flag
pnpm run build:android:release
```

### "Maestro output directory not found"

**Cause**: Maestro test didn't run or failed before creating output.

**Fix**:

```bash
# Create output directory manually
mkdir -p maestro-results

# Run Maestro with explicit output
maestro test .maestro/community/scroll-performance.yaml \
  --format junit \
  --output maestro-results/results.xml
```

### "Perfetto trace is suspiciously small"

**Cause**: Trace collection stopped prematurely or failed.

**Fix**:

```bash
# Verify trace is running
adb shell ps | grep perfetto

# Check trace file size
adb shell ls -lh /data/misc/perfetto-traces/trace

# Increase trace duration if needed (edit duration_ms in config)
```

### "RN Performance JSON not found"

**Cause**: App didn't generate performance report.

**Fix**:

- Ensure `@shopify/react-native-performance` is configured
- Check app logs for performance export errors
- Verify file path: `/sdcard/Android/data/com.growbro.app/files/performance.json`

## 📚 Additional Resources

- [Perfetto UI](https://ui.perfetto.dev) - Trace analysis
- [Maestro Documentation](https://maestro.mobile.dev) - E2E testing
- [RN Performance](https://github.com/Shopify/react-native-performance) - Performance monitoring
- [Sentry Performance](https://docs.sentry.io/product/performance/) - APM
- [React Native Performance Guide](https://reactnative.dev/docs/performance)
- [Expo Performance](https://docs.expo.dev/guides/performance/)

## 🤝 Contributing

When adding new performance tests:

1. Add test to `.maestro/` directory
2. Update budgets in `scripts/ci/performance-validation.js` if needed
3. Document test in this README
4. Add to CI workflow if appropriate
5. Update Visual QA checklist if testing new UI behavior

## 📞 Support

For questions or issues with performance testing:

1. Check this README and linked documentation
2. Review existing Maestro tests for examples
3. Check CI logs for detailed error messages
4. Consult Perfetto traces for performance insights
5. Ask in #performance Slack channel (if available)

---

**Last Updated**: 2025-01-07  
**Spec**: 21. Performance & Reliability  
**Task**: 5. Optimize Image Handling in Lists
