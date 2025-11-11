# Gesture Performance Testing Guide

This document describes the gesture performance testing infrastructure for GrowBro, including automated testing with Perfetto trace collection and performance validation.

## Overview

Gesture performance testing validates that continuous pan/scroll/drag gestures maintain smooth 60 FPS performance with P95 input-to-render latency ≤50ms and dropped frames ≤1%.

**Requirements:** 2.3, 2.4

## Target Metrics

- **P95 Input→Render Latency:** ≤50ms
- **Dropped Frames:** ≤1%
- **Average FPS:** ≥58
- **Jank Count:** ≤5 per 1k frames

## Prerequisites

### Hardware

- Physical Android device with Android 12+ (API 31+) for Perfetto FrameTimeline
- USB debugging enabled
- Device connected via USB

### Software

- Android SDK Platform Tools (adb)
- Maestro CLI (`curl -Ls 'https://get.maestro.mobile.dev' | bash`)
- Release build of GrowBro app (Hermes enabled, no dev menu)

## Test Infrastructure

### Components

1. **Maestro Test Script:** `.maestro/performance/gesture-performance.yaml`
   - Automated gesture interactions
   - Tests draggable agenda items, scroll gestures, and continuous interactions
   - Validates app responsiveness throughout

2. **Perfetto Trace Collection:** `scripts/performance/collect-perfetto-trace.js`
   - Collects FrameTimeline traces during gesture tests
   - Captures input latency, frame drops, and jank events
   - Generates metadata for analysis

3. **Integrated Test Runner:** `scripts/performance/test-gesture-performance.sh`
   - Orchestrates Maestro test + Perfetto trace collection
   - Validates prerequisites and device compatibility
   - Generates comprehensive test reports

4. **Performance Monitoring:** `src/lib/performance/worklet-monitor.ts`
   - Runtime gesture performance tracking
   - Input-to-render latency measurement
   - Frame drop detection

## Running Tests

### Quick Start

```bash
# Run full gesture performance test with Perfetto trace
./scripts/performance/test-gesture-performance.sh

# Specify device (if multiple connected)
./scripts/performance/test-gesture-performance.sh --device DEVICE_ID
```

### Manual Perfetto Collection

```bash
# Start trace collection (30 seconds)
node scripts/performance/collect-perfetto-trace.js --test=gesture-performance

# In another terminal, run Maestro test
maestro test .maestro/performance/gesture-performance.yaml
```

### Maestro Only (No Perfetto)

```bash
maestro test .maestro/performance/gesture-performance.yaml
```

## Test Scenarios

### 1. Draggable Agenda Items

Tests continuous pan gestures on calendar agenda items:

- Long-press activation (180ms)
- Vertical drag to move tasks
- Smooth animation during drag
- Proper drop handling

**Validation:**

- No dropped frames during drag
- Smooth visual feedback
- Responsive gesture handling

### 2. Rapid Scroll Gestures

Tests scroll performance with rapid direction changes:

- 10 rapid up/down scroll cycles
- Continuous momentum scrolling
- Direction change handling

**Validation:**

- Consistent frame times
- No jank during direction changes
- Smooth deceleration

### 3. Feed Scroll Performance

Tests continuous scroll on image-heavy content:

- 15 continuous scroll operations
- Image loading during scroll
- Placeholder rendering

**Validation:**

- No blank cells
- Smooth image transitions
- Memory stability

## Analyzing Results

### Perfetto Trace Analysis

1. **Open Perfetto UI:**
   - Navigate to https://ui.perfetto.dev
   - Upload trace file from `performance-artifacts/`

2. **Key Tracks to Examine:**
   - **FrameTimeline:** Frame production timeline, input latency
   - **SurfaceFlinger:** Display composition, frame deadlines
   - **app.growbro:** App process activity, worklet execution
   - **RenderThread:** UI rendering, draw operations

3. **Metrics to Check:**
   - **Input Latency:** Time from touch to frame present (target: P95 ≤50ms)
   - **Frame Drops:** Frames that missed 16.7ms deadline (target: ≤1%)
   - **Jank Events:** Frames >16.7ms (target: ≤5 per 1k frames)
   - **Worklet Execution:** Time spent in Reanimated worklets

### Performance Report

Test reports are generated in `performance-artifacts/` with:

- Device information (model, Android version)
- Test results (pass/fail)
- Perfetto trace path
- RN Performance metrics
- Timestamp and build hash

Example report structure:

```json
{
  "testName": "gesture-performance-20250108_143022",
  "timestamp": "2025-01-08T14:30:22Z",
  "device": {
    "model": "Pixel 6a",
    "androidVersion": "14",
    "apiLevel": 34
  },
  "results": {
    "maestroTest": "PASS",
    "perfettoTrace": "./performance-artifacts/gesture-trace-2025-01-08.perfetto-trace",
    "rnPerformance": "./performance-artifacts/gesture-performance-rn-performance.json"
  },
  "requirements": ["2.3", "2.4"],
  "targetMetrics": {
    "p95InputToRenderLatency": "≤50ms",
    "droppedFrames": "≤1%",
    "averageFPS": "≥58"
  }
}
```

## Worklet Performance Monitoring

### Runtime Tracking

Use the `useGesturePerformanceTracker` hook to monitor gesture performance in development:

```typescript
import { useGesturePerformanceTracker } from '@/lib/performance/worklet-monitor';

function MyGestureComponent() {
  const { trackGestureStart, trackGestureUpdate, trackGestureEnd, getMetrics } =
    useGesturePerformanceTracker();

  const gesture = Gesture.Pan()
    .onStart(() => {
      trackGestureStart();
    })
    .onUpdate(() => {
      trackGestureUpdate();
      // ... gesture logic
    })
    .onEnd(() => {
      trackGestureEnd();

      if (__DEV__) {
        const metrics = getMetrics();
        console.log('Gesture metrics:', metrics);
      }
    });

  return <GestureDetector gesture={gesture}>...</GestureDetector>;
}
```

### Worklet Execution Monitoring

Track worklet execution time to identify bottlenecks:

```typescript
import { measureWorkletStart, measureWorkletEnd } from '@/lib/performance/worklet-monitor';

const animatedStyle = useAnimatedStyle(() => {
  'worklet';
  const start = measureWorkletStart();

  // ... worklet logic ...

  measureWorkletEnd(start, 'myWorklet');
  return { ... };
});
```

## CI Integration

### GitHub Actions Workflow

Add gesture performance tests to CI pipeline:

```yaml
- name: Run Gesture Performance Tests
  run: |
    ./scripts/performance/test-gesture-performance.sh
  env:
    ANDROID_SERIAL: ${{ secrets.ANDROID_DEVICE_ID }}

- name: Upload Performance Artifacts
  uses: actions/upload-artifact@v3
  if: always()
  with:
    name: gesture-performance-artifacts
    path: performance-artifacts/
```

### Performance Budgets

CI should fail if:

- Maestro test fails
- Perfetto trace collection fails
- P95 latency >50ms (manual verification required)
- Dropped frames >1% (manual verification required)

## Troubleshooting

### Device Not Detected

```bash
# Check device connection
adb devices

# Restart adb server
adb kill-server
adb start-server
```

### Perfetto Trace Collection Fails

- Ensure Android 12+ (API 31+)
- Check device has sufficient storage
- Verify USB debugging is enabled
- Try shorter trace duration

### App Not in Release Mode

```bash
# Check if app is in release mode
adb shell dumpsys package com.growbro.app | grep -i "debuggable"

# Should show: debuggable=false
```

### High Latency/Frame Drops

If tests show high latency or frame drops:

1. **Check Worklets:** Ensure all gesture handlers are marked with `'worklet'`
2. **Verify Shared Values:** Use `useSharedValue`/`useDerivedValue` patterns
3. **Avoid Heavy Computations:** Move expensive operations to JS thread via `runOnJS`
4. **Check Dependencies:** Ensure gesture callbacks have stable dependencies
5. **Profile Worklets:** Use `measureWorkletStart`/`measureWorkletEnd` to identify bottlenecks

## Best Practices

### Gesture Handler Optimization

✅ **DO:**

- Mark all UI-thread functions with `'worklet'`
- Use `useSharedValue` for animated values
- Keep worklets pure and short-running
- Use `runOnJS` for side effects
- Implement callback-based animation completions

❌ **DON'T:**

- Call `console.log` in worklets (ESLint enforced)
- Make network requests in worklets
- Capture large objects in worklet closures
- Use polling loops for animation completion
- Access React state directly in worklets

### Testing Best Practices

- Always test on release builds
- Use physical devices for accurate results
- Test on target devices (Pixel 6a, iPhone 12)
- Collect multiple samples for statistical significance
- Compare results across builds to detect regressions

## References

- [Perfetto UI](https://ui.perfetto.dev)
- [Maestro Documentation](https://maestro.mobile.dev)
- [React Native Reanimated](https://docs.swmansion.com/react-native-reanimated/)
- [Android FrameTimeline](https://perfetto.dev/docs/data-sources/frametimeline)
