# Phase Tracking Performance Guide

This document provides guidelines for verifying that the phase timeline meets the 60 FPS performance budget with 1k+ items.

## Performance Requirements

- **Target**: 60 FPS (16.67ms per frame)
- **Test Dataset**: 1,000+ tasks
- **Device**: Mid-tier Android device (e.g., Moto G-class)
- **Build**: Release build (not debug)

## FlashList v2 Optimizations

The `PhaseTimeline` component uses FlashList v2 with the following optimizations:

1. **Automatic Sizing**: FlashList v2 automatically calculates item sizes without manual `estimatedItemSize` configuration
2. **Memoization**: Timeline items are memoized using `useMemo` to prevent unnecessary recalculations
3. **Simple Item Components**: Task and section items are kept simple with minimal nesting
4. **Key Extraction**: Stable `keyExtractor` using task IDs

## Profiling Steps

### 1. Generate Test Dataset

Create a test playbook with 1,000+ tasks:

```typescript
import { TaskGenerator } from '@/lib/playbooks';

// Generate large dataset for testing
const testPlaybook = {
  // ... playbook with many recurring tasks
};

const generator = new TaskGenerator(database);
await generator.generateTasksFromPlaybook(testPlaybook, plant);
```

### 2. Enable Performance Monitoring

#### React Native Performance Monitor

In development builds, shake the device and enable "Show Perf Monitor" to see FPS in real-time.

#### Flipper Profiler

1. Open Flipper
2. Select your app
3. Go to "React DevTools" → "Profiler"
4. Record a session while scrolling the timeline

#### Android Systrace

For detailed frame timing:

```bash
# Record systrace
adb shell atrace --async_start -b 16000 -a com.yourapp gfx input view webview

# Scroll the timeline for 10 seconds

# Stop and save trace
adb shell atrace --async_stop > trace.html
```

### 3. Performance Checklist

- [ ] Timeline renders without dropped frames on initial load
- [ ] Scrolling maintains 60 FPS with 1k+ items
- [ ] No jank when switching between phases
- [ ] Task press interactions are responsive (<100ms)
- [ ] Memory usage remains stable during scrolling
- [ ] No memory leaks after unmounting

### 4. Metrics to Monitor

| Metric         | Target          | Measurement                |
| -------------- | --------------- | -------------------------- |
| Initial Render | <500ms          | Time to first paint        |
| Scroll FPS     | 60 FPS          | Frame rate during scroll   |
| JS Thread      | <16ms           | JavaScript execution time  |
| UI Thread      | <16ms           | Native UI rendering time   |
| Memory         | <100MB increase | Memory delta during scroll |

### 5. Common Performance Issues

#### Dropped Frames

**Symptoms**: Stuttering during scroll, FPS drops below 60

**Solutions**:

- Ensure release build is being tested
- Check for expensive computations in render
- Verify memoization is working
- Profile with React DevTools

#### Memory Leaks

**Symptoms**: Memory usage increases over time, app crashes

**Solutions**:

- Check for unsubscribed listeners
- Verify cleanup in useEffect hooks
- Use React DevTools Memory Profiler

#### Slow Initial Render

**Symptoms**: Long delay before timeline appears

**Solutions**:

- Optimize data transformation in useMemo
- Consider pagination or windowing
- Profile with Flipper

## Optimization Techniques

### 1. Data Transformation

Keep data transformation outside of render:

```typescript
const timelineItems = useMemo(() => {
  // Transform tasks into timeline items
  return transformTasks(tasks);
}, [tasks]);
```

### 2. Component Memoization

Memoize expensive child components:

```typescript
const TaskItem = React.memo(({ task, onPress }) => {
  // Component implementation
});
```

### 3. Avoid Inline Functions

Extract callbacks to avoid recreating functions:

```typescript
const handleTaskPress = useCallback((taskId: string) => {
  // Handle press
}, []);
```

### 4. Optimize Images

If task items include images:

- Use appropriate image sizes
- Enable caching
- Consider lazy loading

## Testing Procedure

1. **Build Release APK**:

   ```bash
   pnpm build:development:android
   ```

2. **Install on Test Device**:

   ```bash
   adb install app-release.apk
   ```

3. **Generate Test Data**:
   - Create a plant with a playbook
   - Generate 1,000+ tasks

4. **Profile Performance**:
   - Enable Perf Monitor
   - Scroll through entire timeline
   - Record FPS metrics
   - Check for dropped frames

5. **Document Results**:
   - Record average FPS
   - Note any dropped frames
   - Document device specs
   - Save profiler traces

## Acceptance Criteria

✅ Timeline maintains 60 FPS with 1,000+ tasks on mid-tier Android device in release build
✅ No dropped frames during normal scrolling
✅ Initial render completes in <500ms
✅ Memory usage remains stable
✅ Task interactions are responsive

## Troubleshooting

### FPS Below 60

1. Check if running in debug mode (debug builds are slower)
2. Profile with React DevTools to find expensive renders
3. Verify FlashList is being used (not FlatList)
4. Check for console.log statements (remove in production)

### Memory Issues

1. Use React DevTools Memory Profiler
2. Check for event listener leaks
3. Verify cleanup in useEffect hooks
4. Monitor with Android Studio Memory Profiler

### Slow Scrolling

1. Simplify item components
2. Remove unnecessary re-renders
3. Optimize data transformations
4. Consider reducing item complexity

## References

- [FlashList Performance](https://shopify.github.io/flash-list/docs/performance)
- [React Native Performance](https://reactnative.dev/docs/performance)
- [Profiling React Native](https://reactnative.dev/docs/profiling)
