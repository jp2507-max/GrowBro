# Performance Testing Infrastructure

This document describes the performance testing infrastructure for GrowBro, including test execution, artifact collection, and performance budget enforcement.

## Overview

The performance testing infrastructure consists of:

1. **Synthetic Data Factory** - Generates deterministic test data (1k+ items)
2. **Maestro Test Scripts** - Automated performance tests for scrolling, startup, and navigation
3. **Perfetto Trace Collection** - Android FrameTimeline traces for jank attribution
4. **Performance Budgets** - CI/CD gates that fail on performance regressions
5. **Artifact Collection** - RN Performance JSON, Sentry traces, Perfetto traces

## Quick Start

### Prerequisites

```bash
# Install Maestro CLI
curl -Ls 'https://get.maestro.mobile.dev' | bash

# Verify installation
maestro --version

# Ensure ADB is available (for Android)
adb version
```

### Running Performance Tests

```bash
# Run all performance tests
pnpm perf:test

# Run Android-specific tests
pnpm perf:test:android

# Run iOS-specific tests
pnpm perf:test:ios

# Run individual test suites
pnpm perf:maestro:scroll    # Scroll performance
pnpm perf:maestro:startup   # Startup performance
```

## Test Suites

### 1. Agenda Scroll Performance Test

**File**: `.maestro/performance/agenda-scroll-performance.yaml`

**Purpose**: Validates FlashList v2 performance with heterogeneous list content (date headers + task rows)

**Test Steps**:

1. Login and navigate to Agenda tab
2. 30-second continuous scroll over 1,000+ tasks
3. Bidirectional scroll test (up and down)
4. Rapid scroll stress test (5 iterations)
5. Interaction test after heavy scrolling

**Success Criteria**:

- Average FPS ≥58
- P95 frame time ≤16.7ms
- Dropped frames ≤1%
- 0 blank cells observed
- App remains responsive after test

### 2. Community Feed Scroll Performance Test

**File**: `.maestro/community/scroll-performance.yaml`

**Purpose**: Validates image-heavy list performance with mixed media content

**Test Steps**:

1. Login and navigate to Community tab
2. 30-second continuous scroll over 1,000+ posts
3. Bidirectional scroll test
4. Rapid scroll stress test
5. Interaction test after scrolling

**Success Criteria**:

- Average FPS ≥58
- P95 frame time ≤16.7ms
- Dropped frames ≤1%
- 0 blank cells observed
- All images show placeholder or content (never blank)
- Memory increase ≤50 MB during scroll
- Post-GC memory within ≤10 MB of baseline

### 3. Rapid Scroll Stress Test

**File**: `.maestro/performance/rapid-scroll-test.yaml`

**Purpose**: Validates FlashList v2 cell recycling under extreme conditions

**Test Steps**:

1. Login and navigate to Community tab
2. 10 rapid top↔bottom scroll iterations
3. Verify no blank cells after each iteration
4. Test interaction after stress test

**Success Criteria**:

- 0 blank cells during all 10 iterations
- All images show placeholder or content
- App remains responsive
- No crashes or ANR events

### 4. Startup Performance Test

**File**: `.maestro/performance/startup-performance.yaml`

**Purpose**: Validates cold start and warm start performance

**Test Steps**:

1. Force stop app (cold start)
2. Launch app and measure TTI
3. Background app (warm start)
4. Relaunch and measure resume time
5. Navigate through main screens

**Success Criteria**:

- Cold start TTI: ≤1.8s (Pixel 6a), ≤1.3s (iPhone 12)
- Warm start: ≤500ms
- Screen transitions: ≤250ms (P95)
- Data-heavy screens load: ≤2s

## Synthetic Data Factory

### Usage

```typescript
import {
  generateSyntheticPosts,
  generateSyntheticTasks,
  generateSyntheticAgendaItems,
  generateMixedSyntheticData,
} from '@/scripts/ci/synthetic-data-factory';

// Generate 1000 posts with images
const posts = generateSyntheticPosts({
  seed: 42,
  count: 1000,
  includeImages: true,
  mixedTypes: true,
});

// Generate 1000 tasks
const tasks = generateSyntheticTasks({
  seed: 42,
  count: 1000,
});

// Generate mixed data for heterogeneous lists
const mixed = generateMixedSyntheticData({
  seed: 42,
  count: 1000,
});
```

### Data Characteristics

**Posts**:

- Mix of text-only and image posts (70% with images)
- Realistic image dimensions (1080-2048px)
- BlurHash and ThumbHash placeholders
- Varied like/comment counts
- Deterministic generation (same seed = same data)

**Tasks**:

- Mix of pending, completed, and skipped tasks
- Varied due dates and reminders
- Realistic task titles and descriptions
- Deterministic generation

**Agenda Items**:

- Date headers + task rows
- 3-5 tasks per date
- Heterogeneous list structure

## Performance Budgets

### Scroll Performance

```typescript
{
  scrolling: {
    p95FrameTime: 16.7,        // ms
    droppedFrameThreshold: 1,   // %
    averageFPSThreshold: 58,    // fps
    jankCount: 5,               // per 1k frames
    blankCells: 0               // absolute
  }
}
```

### Startup Performance

```typescript
{
  startup: {
    ttiThresholds: {
      pixel6a: 1800,    // ms
      iphone12: 1300,   // ms
    },
    coldStartThreshold: 2000,  // ms
    warmStartThreshold: 500,   // ms
  }
}
```

### Navigation Performance

```typescript
{
  navigation: {
    transitionThreshold: 250,  // ms (P95)
  }
}
```

### Memory Performance

```typescript
{
  memory: {
    scrollDeltaThreshold: 50,     // MB
    postGCDeltaThreshold: 10,     // MB
  }
}
```

## Artifact Collection

### Collected Artifacts

1. **Device Metadata** (`device-metadata-{timestamp}.json`)
   - Platform, device model, OS version
   - Build hash, timestamp
   - Test type

2. **Maestro Test Results** (`{test-name}-{timestamp}.xml`)
   - JUnit format test results
   - Pass/fail status for each test
   - Execution time

3. **Perfetto Traces** (`perfetto-trace-{timestamp}.pb`) - Android only
   - FrameTimeline data for jank attribution
   - Process stats for memory tracking
   - System trace for CPU/GPU

4. **Performance Summary** (`performance-summary-{timestamp}.json`)
   - Aggregated test results
   - Pass/fail counts
   - Links to all artifacts

### Artifact Structure

```
performance-artifacts/
├── device-metadata-20250108_143022.json
├── agenda-scroll-performance-20250108_143022.xml
├── rapid-scroll-test-20250108_143022.xml
├── startup-performance-20250108_143022.xml
├── perfetto-trace-20250108_143022.pb
└── performance-summary-20250108_143022.json
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
  performance-android:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install Maestro
        run: curl -Ls 'https://get.maestro.mobile.dev' | bash

      - name: Setup Android Emulator
        uses: reactivecircus/android-emulator-runner@v2
        with:
          api-level: 33
          target: google_apis
          arch: x86_64
          profile: pixel_6a

      - name: Build Release APK
        run: pnpm run build:production:android

      - name: Run Performance Tests
        run: pnpm perf:test:android

      - name: Upload Artifacts
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: performance-artifacts-android
          path: ./performance-artifacts/

      - name: Check Performance Budgets
        run: node scripts/ci/performance-validation.js
```

## Local Testing

### Prerequisites

1. **Physical Device** (recommended for accurate results)
   - Android 12+ for Perfetto support
   - USB debugging enabled
   - See [Physical Device Setup](./physical-device-setup.md)

2. **Release Build**
   - Performance tests MUST run on release builds
   - Dev builds have different performance characteristics

### Running Tests Locally

```bash
# 1. Build release version
pnpm run build:production:android  # or :ios

# 2. Install on device
# Android: APK is automatically installed
# iOS: Install via Xcode or TestFlight

# 3. Connect device
adb devices  # Android
# iOS: Device should appear in Xcode

# 4. Run performance tests
pnpm perf:test:android  # or :ios

# 5. Check results
ls -la ./performance-artifacts/
```

### Analyzing Results

#### Perfetto Traces (Android)

1. Open https://ui.perfetto.dev
2. Load `perfetto-trace-{timestamp}.pb`
3. Look for:
   - Red frames (janky frames >16.7ms)
   - Frame duration timeline
   - Memory usage patterns
   - CPU/GPU utilization

#### Maestro Test Results

```bash
# View test results
cat ./performance-artifacts/agenda-scroll-performance-*.xml

# Check summary
cat ./performance-artifacts/performance-summary-*.json | jq
```

## Troubleshooting

### Tests Fail on Dev Builds

**Problem**: Performance tests fail with "Development Menu" visible

**Solution**: Ensure you're running release builds:

```bash
# Android
pnpm run build:production:android

# iOS
pnpm run build:production:ios
```

### No Perfetto Trace Collected

**Problem**: Perfetto trace file is missing or empty

**Solutions**:

1. Check device permissions:

   ```bash
   adb shell ls -la /data/misc/perfetto-traces/
   ```

2. Ensure Android 12+ device

3. Try with root access (if available):
   ```bash
   adb root
   ```

### Inconsistent Performance Results

**Problem**: Test results vary significantly between runs

**Solutions**:

1. Close background apps
2. Disable battery saver mode
3. Let device cool down between tests
4. Run multiple iterations and average results
5. Use same device model for all tests

### Memory Budget Exceeded

**Problem**: Memory usage exceeds 50 MB during scroll

**Solutions**:

1. Check for memory leaks with Perfetto
2. Verify image optimization (thumbnails, placeholders)
3. Review FlashList configuration
4. Check for retained closures in worklets

## Best Practices

### Test Design

1. **Use synthetic data** for deterministic results
2. **Test on release builds** only
3. **Run on physical devices** when possible
4. **Isolate test scenarios** (one feature per test)
5. **Document test intent** in YAML comments

### Result Analysis

1. **Compare against baseline** metrics
2. **Focus on P95 values** (more reliable than averages)
3. **Investigate >10% regressions** immediately
4. **Track trends over time** (not just single runs)
5. **Document anomalies** in test results

### CI Integration

1. **Fail builds on budget violations**
2. **Archive all artifacts** for historical analysis
3. **Run on consistent hardware**
4. **Set up performance dashboards**
5. **Alert on regressions**

## Additional Resources

- [Physical Device Setup](./physical-device-setup.md)
- [Flashlight Integration](./flashlight-integration.md)
- [Image Optimization Visual QA](./image-optimization-visual-qa.md)
- [Maestro Documentation](https://maestro.mobile.dev/)
- [Perfetto Documentation](https://perfetto.dev/)
- [React Native Performance](https://reactnative.dev/docs/performance)
