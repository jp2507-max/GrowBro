# Harvest Workflow Performance Testing Guide

**Requirements:** Task 16 - Optimize performance and finalize implementation

This document provides instructions for conducting final performance testing on mid-tier Android devices with production builds.

## Overview

Performance testing validates that the harvest workflow meets the following targets:

- **Charts**: 60fps rendering for 0-365 day datasets
- **Lists**: 60fps scrolling with 1000+ items on FlashList v2
- **Photo Storage**: Efficient LRU cleanup and orphan detection
- **Sync**: Reliable offline-first operations with telemetry
- **Notifications**: Consistent scheduling and rehydration success

---

## Test Environment Setup

### 1. Target Devices

Test on mid-tier Android devices representing the user base:

- **Device 1**: Samsung Galaxy A32 (Android 11, 4GB RAM, Exynos 850)
- **Device 2**: Xiaomi Redmi Note 10 (Android 11, 4GB RAM, Snapdragon 678)
- **Device 3**: Google Pixel 4a (Android 13, 6GB RAM, Snapdragon 730G)

### 2. Build Configuration

Use production builds to reflect real-world performance:

```bash
# Android production build
eas build --profile production --platform android

# Or local production build
pnpm run build:android:production
```

**Build Settings**:

- Hermes enabled
- ProGuard/R8 minification enabled
- No dev tools or debugging
- Production API endpoints
- New Architecture enabled

---

## Performance Test Scenarios

### Scenario 1: Chart Rendering Performance

**Objective**: Validate smooth rendering for large datasets

**Steps**:

1. Generate test data:

   ```typescript
   // Use test-generators.ts
   import { generateHarvestDataPoints } from '@/lib/test-generators';

   const data365 = generateHarvestDataPoints(365); // 1 year
   const data730 = generateHarvestDataPoints(730); // 2 years
   ```

2. Render WeightChart with datasets:
   - 0-50 points (no downsampling)
   - 100-365 points (downsampling threshold)
   - 365-730 points (heavy downsampling)

3. Measure performance:
   - Initial render time < 100ms
   - Smooth 60fps during pan/zoom interactions
   - No frame drops during data updates

**Validation**:

```bash
# Check logs for downsampling metrics
adb logcat | grep "WeightChart"
# Expected: "Processed 730 → 365 points in X.XXms"
```

**Success Criteria**:

- ✅ 365-day dataset renders in < 100ms
- ✅ Maintains 60fps during interactions
- ✅ LTTB downsampling activates for datasets > 365 points
- ✅ Fallback to tabular view on render errors

---

### Scenario 2: List Scrolling Performance (FlashList v2)

**Objective**: Validate 60fps scrolling with large datasets

**Steps**:

1. Generate test harvests:

   ```typescript
   const harvests = Array.from({ length: 1000 }, (_, i) => ({
     id: `test-${i}`,
     stage: HarvestStage.DRYING,
     updatedAt: new Date(Date.now() - i * 86400000),
     // ... other fields
   }));
   ```

2. Test HarvestHistoryList:
   - Initial render with 100 items
   - Scroll to end (1000 items)
   - Apply filters and re-scroll
   - Toggle between states (active/completed)

3. Monitor frame rate:
   - Use React DevTools Profiler
   - Check `adb shell dumpsys gfxinfo <package>` for frame stats

**Validation**:

```bash
# Enable GPU rendering profiling
adb shell setprop debug.hwui.profile true

# Capture frame stats
adb shell dumpsys gfxinfo com.growbro reset
# Scroll list, then:
adb shell dumpsys gfxinfo com.growbro
```

**Success Criteria**:

- ✅ No size estimates used (FlashList v2 defaults)
- ✅ Maintains 60fps during fast scrolling
- ✅ Memoized renderItem, keyExtractor, and separator
- ✅ < 16ms per frame (60fps = 16.67ms)
- ✅ No jank or stuttering

---

### Scenario 3: Photo Storage Cleanup

**Objective**: Validate efficient LRU cleanup and orphan detection

**Steps**:

1. Simulate storage usage:

   ```typescript
   // Generate 100 harvest photos (300 variants = 300 files)
   const photos = await generateTestPhotos(100);
   ```

2. Test background cleanup:

   ```typescript
   import { cleanupLRU } from '@/lib/media/photo-janitor';

   const result = await cleanupLRU(
     DEFAULT_PHOTO_STORAGE_CONFIG,
     referencedUris,
     false // non-aggressive
   );

   console.log('Cleanup result:', result);
   ```

3. Test manual cleanup:
   - Navigate to Settings → Storage
   - Tap "Free up space"
   - Verify cleanup metrics

**Validation**:

- Check cleanup duration (should be < 2s for 300 files)
- Verify orphaned files are removed
- Ensure recent photos (< 30 days) are protected
- Battery-aware scheduling works correctly

**Success Criteria**:

- ✅ Cleanup completes in < 2 seconds for 300 files
- ✅ Orphan detection accuracy 100%
- ✅ Recent photos protected (< 30 days)
- ✅ Battery-aware: skips cleanup when low battery and not charging

---

### Scenario 4: Offline-First Sync Performance

**Objective**: Validate reliable offline operations and sync

**Steps**:

1. Enable airplane mode
2. Create 10 harvests with photos
3. Advance through stages (Harvest → Drying → Curing)
4. Disable airplane mode
5. Trigger sync and measure:
   - Push changes duration
   - Pull changes duration
   - Conflict resolution (if any)
   - Photo upload queue processing

**Validation**:

```bash
# Check sync telemetry logs
adb logcat | grep "sync_"
# Expected metrics: duration_ms, pushed, applied, conflicts
```

**Success Criteria**:

- ✅ All 10 harvests created offline without errors
- ✅ Sync completes in < 5 seconds for 10 harvests
- ✅ No data loss during sync
- ✅ Last-Write-Wins conflict resolution works correctly
- ✅ Photo upload queue processes all variants

---

### Scenario 5: Notification Scheduling & Rehydration

**Objective**: Validate notification delivery and rehydration success

**Steps**:

1. Create 5 harvests in different stages
2. Schedule notifications for each stage
3. Kill and restart app
4. Check notification rehydration metrics:

   ```typescript
   import { getNotificationHealthMetrics } from '@/lib/harvest/notification-monitoring';

   const metrics = getNotificationHealthMetrics();
   console.log('Notification health:', metrics);
   ```

**Validation**:

- Check rehydration stats in logs
- Verify scheduled notifications in system settings
- Test notification delivery (advance time if needed)

**Success Criteria**:

- ✅ Schedule success rate > 95%
- ✅ Rehydration success rate > 95%
- ✅ Rehydration duration < 500ms for 50 harvests
- ✅ No duplicate notifications after rehydration

---

## Performance Metrics Collection

### 1. Enable Performance Monitoring

```typescript
// In app initialization
import { initializeBackgroundCleanup } from '@/lib/media/background-photo-cleanup';
import { rehydrateNotifications } from '@/lib/harvest/harvest-notification-service';
import { getNotificationHealthMetrics } from '@/lib/harvest/notification-monitoring';

// Start background cleanup
initializeBackgroundCleanup(referencedUris);

// Rehydrate notifications
const rehydrationStats = await rehydrateNotifications();
console.log('Rehydration stats:', rehydrationStats);

// Check health metrics
const notificationHealth = getNotificationHealthMetrics();
console.log('Notification health:', notificationHealth);
```

### 2. Collect Telemetry (Opt-In)

Sync telemetry is already integrated. Monitor via `src/lib/sync/sync-analytics.ts`:

- Sync duration (push/pull/apply/total)
- Payload sizes
- Conflict rates
- Retry attempts
- Checkpoint age

### 3. React Native Performance Monitor

Enable on-device FPS monitor:

```typescript
// In development only
if (__DEV__) {
  import('react-native').then(({ PerformanceMonitor }) => {
    PerformanceMonitor?.enable();
  });
}
```

---

## Regression Testing

### Automated Performance Tests

Run existing test suite with coverage:

```bash
# Unit tests with performance assertions
pnpm test src/lib/harvest/lttb-downsample.test.ts --coverage
pnpm test src/components/harvest/weight-chart.test.tsx --coverage
pnpm test src/lib/media/photo-janitor.test.ts --coverage

# Integration tests
pnpm test src/lib/harvest/__tests__/
```

### Manual Regression Checklist

- [ ] Chart renders 365-day dataset smoothly
- [ ] List scrolling at 60fps with 1000 items
- [ ] Photo cleanup completes in < 2 seconds
- [ ] Sync completes in < 5 seconds for 10 harvests
- [ ] Notifications schedule and rehydrate successfully
- [ ] No memory leaks during extended usage
- [ ] No frame drops during animations
- [ ] Battery usage acceptable (< 2% per hour in background)

---

## Known Performance Considerations

### 1. FlashList v2 Performance

- **Dev builds**: FlashList feels slower in dev mode. Always test with production builds.
- **Memoization**: Ensure `renderItem`, `keyExtractor`, and `ItemSeparatorComponent` are memoized.
- **No size estimates**: FlashList v2 handles sizing automatically.

### 2. Chart Downsampling

- **LTTB algorithm**: Reduces 730 points → 365 points while preserving visual shape.
- **Dev logging**: Performance logs are only in dev mode (`__DEV__`).
- **Fallback**: Tabular view on render errors (requirement 4.6).

### 3. Photo Storage

- **LRU cleanup**: Runs in background; battery-aware scheduling.
- **Orphan detection**: Compares file system to database references.
- **Protection**: Recent photos (< 30 days) are protected from cleanup.

### 4. Sync Conflicts

- **Last-Write-Wins**: Server `updated_at` is authoritative.
- **Conflict notification**: `conflict_seen` flag shows "Updated elsewhere" banner.
- **Idempotency**: UUID-based keys prevent duplicate operations.

---

## Reporting Results

After completing all scenarios, document results:

### Performance Report Template

```markdown
## Harvest Workflow Performance Report

**Date**: YYYY-MM-DD
**Tester**: [Name]
**Device**: [Model, Android Version, RAM]
**Build**: [EAS Build ID or local commit SHA]

### Chart Rendering

- 365-day dataset render time: \_\_ms ✅/❌
- 60fps during interactions: ✅/❌
- Downsampling activated: ✅/❌

### List Scrolling

- 1000 items scrolling: \_\_fps ✅/❌
- Frame time: \_\_ms ✅/❌
- Memoization verified: ✅/❌

### Photo Cleanup

- Cleanup duration (300 files): \_\_s ✅/❌
- Orphan detection accuracy: \_\_% ✅/❌
- Battery-aware scheduling: ✅/❌

### Sync Performance

- Sync duration (10 harvests): \_\_s ✅/❌
- Data integrity: ✅/❌
- Conflict resolution: ✅/❌

### Notifications

- Schedule success rate: \_\_% ✅/❌
- Rehydration success rate: \_\_% ✅/❌
- Rehydration duration: \_\_ms ✅/❌

### Overall Assessment

[Summary of findings, issues, and recommendations]
```

---

## Troubleshooting

### Chart Performance Issues

**Symptom**: Slow rendering or frame drops

**Solutions**:

1. Verify downsampling is active (`shouldDownsample` returns true)
2. Check memoization of `chartData` and `chartConfig`
3. Use React.memo on WeightChart component
4. Test with production build (dev mode has overhead)

### List Performance Issues

**Symptom**: Stuttering during scroll

**Solutions**:

1. Verify FlashList v2 props (no size estimates)
2. Check memoization of `renderItem`, `keyExtractor`
3. Use React DevTools Profiler to find expensive renders
4. Ensure row component is memoized with `React.memo`

### Cleanup Issues

**Symptom**: Cleanup takes too long or fails

**Solutions**:

1. Check file count and total size
2. Verify orphan detection logic
3. Test with aggressive mode for faster cleanup
4. Monitor battery state during cleanup

### Sync Issues

**Symptom**: Slow sync or conflicts

**Solutions**:

1. Check network latency and payload sizes
2. Verify WatermelonDB outbox is not bloated
3. Test incremental sync with `last_pulled_at` checkpoint
4. Review conflict resolution strategy (LWW)

---

## Conclusion

This guide ensures comprehensive performance testing for the harvest workflow. All scenarios should pass on mid-tier Android devices before final release.

**Next Steps**:

1. Execute all test scenarios on target devices
2. Document results using the report template
3. Address any performance regressions
4. Validate fixes with regression tests
5. Sign off on Task 16 completion
