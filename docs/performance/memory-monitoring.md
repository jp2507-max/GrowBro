# Memory Monitoring and Leak Detection

This document describes the memory monitoring and leak detection system for GrowBro's performance testing infrastructure.

## Overview

The memory monitoring system tracks memory usage during performance tests to detect memory leaks and ensure the app stays within defined memory budgets. This is critical for maintaining smooth performance, especially on lower-end devices.

## Memory Budgets

Based on **Requirement 5.4**, the following memory budgets are enforced:

- **RSS Delta during 60s scroll**: ≤50 MB
- **Post-GC Delta**: ≤10 MB (memory should return to near baseline after garbage collection)

These budgets are validated in CI/CD pipelines and will fail the build if exceeded.

## Architecture

### Components

1. **Memory Monitor** (`src/lib/performance/memory-monitor.ts`)
   - Captures memory metrics snapshots
   - Provides utilities for memory sampling and analysis
   - Platform-agnostic memory tracking

2. **Memory Leak Detector** (`src/lib/performance/memory-leak-detector.ts`)
   - Runs 60-second scroll tests with memory sampling
   - Validates against memory budgets
   - Generates detailed leak detection reports

3. **Memory Monitor Hook** (`src/lib/hooks/use-memory-monitor.ts`)
   - React hook for component-level memory monitoring
   - Useful for development and debugging
   - Tracks memory delta over component lifecycle

4. **CI Integration** (`.github/workflows/performance-tests.yml`)
   - Automated memory testing in CI/CD
   - Budget validation and failure gates
   - Artifact collection and reporting

## Usage

### Development Monitoring

Use the `useMemoryMonitor` hook to track memory usage during development:

```tsx
import { useMemoryMonitor } from '@/lib/hooks/use-memory-monitor';

function MyScreen() {
  const memory = useMemoryMonitor({
    enabled: __DEV__,
    intervalMs: 5000,
    logToConsole: true,
  });

  if (__DEV__) {
    console.log(`Memory delta: ${memory.deltaMB.toFixed(2)} MB`);
  }

  return <View>...</View>;
}
```

### Manual Testing

Run memory leak detection manually:

```typescript
import { detectMemoryLeaks } from '@/lib/performance/memory-leak-detector';

const result = await detectMemoryLeaks(
  'Community Feed Scroll',
  60000, // 60 seconds
  {
    maxRSSDeltaMB: 50,
    maxPostGCDeltaMB: 10,
    testDurationSeconds: 60,
  }
);

console.log(formatMemoryLeakResult(result));
```

### CI/CD Testing

Memory tests run automatically in CI:

```bash
# Run Maestro memory test
maestro test .maestro/performance/memory-scroll-test.yaml

# Validate memory budgets
node scripts/ci/memory-budget-validator.js maestro-results/memory-report.json
```

## Memory Metrics

### Captured Metrics

- **heapUsed**: JavaScript heap memory in use (bytes)
- **heapTotal**: Total JavaScript heap size (bytes)
- **rssMemory**: Resident Set Size - total memory allocated (bytes)
- **imageMemoryUsage**: Memory used by image cache (optional)
- **cacheMemoryUsage**: Memory used by other caches (optional)

### Measurement Points

1. **Baseline**: Captured before test starts
2. **Peak**: Highest memory usage during test
3. **Post-GC**: Memory after forced garbage collection

## Test Scenarios

### 60-Second Scroll Test

The primary memory leak detection test:

1. Navigate to media-rich list (Community Feed)
2. Capture baseline memory
3. Scroll continuously for 60 seconds (up and down)
4. Sample memory every 5 seconds
5. Force garbage collection
6. Capture post-GC memory
7. Validate against budgets

### Budget Validation

Memory budgets are validated in CI:

```javascript
// RSS Delta Check
if (rssDelta > 50 MB) {
  throw new Error('RSS delta exceeds budget');
}

// Post-GC Delta Check
if (postGCDelta > 10 MB) {
  throw new Error('Post-GC delta exceeds budget');
}
```

## Platform Considerations

### Android

- Uses `performance.memory` API for heap metrics
- Perfetto traces provide additional memory profiling
- Physical devices recommended for accurate RSS measurements

### iOS

- Uses `performance.memory` API
- Instruments can be used for detailed memory profiling
- Simulator memory behavior may differ from physical devices

### Garbage Collection

- Requires `--expose-gc` flag in release builds
- GC is forced after test completion
- 2-second wait after GC to allow memory to stabilize

## CI/CD Integration

### Workflow Steps

1. Build release APK/IPA
2. Start emulator/simulator
3. Run scroll performance test
4. Run memory leak detection test
5. Validate memory budgets
6. Collect artifacts
7. Generate reports

### Artifacts

Memory test artifacts include:

- `memory-report.json`: Detailed memory metrics
- `memory-test-results.xml`: JUnit test results
- Perfetto traces (Android)
- Performance reports with memory deltas

### Failure Handling

CI will fail if:

- RSS delta exceeds 50 MB
- Post-GC delta exceeds 10 MB
- Memory report is malformed
- Test crashes or times out

## Troubleshooting

### High Memory Usage

If memory tests fail:

1. Check for image cache issues (use thumbnails, not full-res)
2. Verify expo-image cache policies are configured
3. Look for retained references in closures
4. Check for event listener leaks
5. Review Perfetto traces for memory spikes

### Flaky Tests

If memory tests are inconsistent:

1. Ensure tests run on release builds only
2. Verify GC is exposed (`--expose-gc`)
3. Check for background processes affecting memory
4. Use physical devices for ground truth
5. Increase sampling interval if needed

### Missing Metrics

If memory metrics are not captured:

1. Verify `performance.memory` is available
2. Check platform-specific memory APIs
3. Ensure app has proper permissions
4. Review logs for memory monitor errors

## Best Practices

### Image Optimization

- Use `expo-image` with `cachePolicy: 'memory-disk'`
- Serve thumbnails during scroll (≤200px)
- Use BlurHash/ThumbHash placeholders
- Avoid decoding full-resolution images in lists

### Component Design

- Clean up event listeners in `useEffect` cleanup
- Avoid large closures in callbacks
- Use `React.memo` for expensive list items
- Implement proper key extraction for lists

### Testing

- Always test on release builds
- Use deterministic test scenarios
- Validate on target devices (Pixel 6a, iPhone 12)
- Monitor trends over time, not just single runs

## References

- [Requirement 5.4](../../.kiro/specs/21.%20performance-and-reliability/requirements.md#requirement-5)
- [Design Document](../../.kiro/specs/21.%20performance-and-reliability/design.md#memory-management-standards)
- [Performance Testing Guide](./image-optimization-visual-qa.md)
- [React Native Performance API](https://reactnative.dev/docs/performance)
