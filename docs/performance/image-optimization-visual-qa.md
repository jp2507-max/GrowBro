# Image Optimization Visual QA Checklist

## Overview

This document provides a comprehensive manual testing checklist for validating the image optimization implementation in community feeds and other list views. All items must be verified and signed off by design/QA before closing Task 5 of the Performance & Reliability spec.

**Related Requirements**: Spec 21, Requirement 5.4 (Memory Management), Requirement 1.2 (Blank Cells)

## Test Environment Setup

### Prerequisites

- [ ] **Release build** installed on physical devices (not emulator)
- [ ] Target devices available:
  - [ ] Pixel 6a (Android 14)
  - [ ] Moto G Power/G Play (Android 13) - low-end device
  - [ ] iPhone 12 (iOS 17/18)
- [ ] Database seeded with test data:
  - [ ] 1000+ community posts
  - [ ] Mix of content types: text-only, single image, multiple images
  - [ ] Varied image sizes: small (< 500KB), medium (500KB-2MB), large (2MB-5MB)
  - [ ] Mix of aspect ratios: portrait, landscape, square
  - [ ] Some legacy posts (no variants) for fallback testing
- [ ] Network conditions simulator ready:
  - [ ] Fast WiFi (baseline)
  - [ ] Slow 3G (1.6 Mbps down, 750ms RTT)
  - [ ] Offline mode
- [ ] Screen recording tools ready for documentation

### Build Verification

- [ ] Verify `__DEV__` is `false` (no dev menu accessible)
- [ ] Verify Hermes is enabled (check Metro logs)
- [ ] Verify no debug/profiling overlays active
- [ ] Verify Sentry is configured with correct environment

---

## 1. Placeholder Behavior Testing

### 1.1 BlurHash Placeholders

**Test Scenario**: Verify BlurHash placeholders display correctly while images load

**Steps**:

1. Enable slow 3G network simulation
2. Navigate to community feed
3. Scroll to new content (uncached images)
4. Observe placeholder behavior

**Acceptance Criteria**:

- [ ] BlurHash placeholder appears **immediately** (< 100ms)
- [ ] Placeholder matches dominant color of final image
- [ ] Placeholder is **blurred** and low-resolution (not pixelated)
- [ ] No white/blank rectangles visible at any point
- [ ] Smooth transition from BlurHash → thumbnail → full image
- [ ] Placeholder maintains correct aspect ratio

**Screenshot Required**: Yes - capture BlurHash → image transition

---

### 1.2 ThumbHash Placeholders (if implemented)

**Test Scenario**: Verify ThumbHash placeholders as alternative to BlurHash

**Steps**:

1. Check if ThumbHash is used (see post metadata)
2. Enable slow 3G network simulation
3. Scroll through feed observing placeholders

**Acceptance Criteria**:

- [ ] ThumbHash placeholder renders with better color accuracy than BlurHash
- [ ] Placeholder appears immediately (< 100ms)
- [ ] Smooth transition to full image
- [ ] No visual artifacts or color banding

**Screenshot Required**: Yes - side-by-side BlurHash vs ThumbHash

---

### 1.3 Thumbnail Loading

**Test Scenario**: Verify thumbnail variants load during scroll

**Steps**:

1. Enable normal WiFi
2. Scroll through feed at moderate speed
3. Observe image loading sequence

**Acceptance Criteria**:

- [ ] Thumbnails (~200px) load **first** during scroll
- [ ] Thumbnails are sharp and clear (not overly compressed)
- [ ] Full resolution (~1280px) loads when scroll stops
- [ ] No "pop-in" effect when upgrading from thumbnail to full
- [ ] Thumbnail quality acceptable for small preview

**Screenshot Required**: Yes - thumbnail vs full resolution comparison

---

## 2. Dark Mode Testing

### 2.1 Placeholder Appearance in Dark Mode

**Test Scenario**: Verify placeholders look good in dark theme

**Steps**:

1. Enable dark mode in app settings
2. Navigate to community feed
3. Enable slow 3G network
4. Scroll to uncached content

**Acceptance Criteria**:

- [ ] BlurHash/ThumbHash placeholders don't appear too bright in dark mode
- [ ] Placeholder colors blend well with dark background
- [ ] No jarring contrast when placeholder → image transition occurs
- [ ] Loading spinners use correct dark mode colors
- [ ] Image borders/shadows respect dark mode theme

**Screenshot Required**: Yes - dark mode placeholders and transitions

---

### 2.2 Image Contrast in Dark Mode

**Test Scenario**: Verify images display correctly in dark mode

**Steps**:

1. View various post images in dark mode
2. Compare with light mode appearance

**Acceptance Criteria**:

- [ ] Images maintain correct colors (no color inversion)
- [ ] Image borders visible but not too bright
- [ ] Text overlays on images remain readable
- [ ] No color banding or artifacts in dark mode

**Screenshot Required**: Yes - same image in light vs dark mode

---

## 3. Network Condition Testing

### 3.1 Slow Network (3G)

**Test Scenario**: Verify graceful degradation on slow networks

**Steps**:

1. Enable slow 3G simulation (1.6 Mbps, 750ms RTT)
2. Navigate to community feed
3. Scroll through 50+ posts
4. Monitor loading behavior

**Acceptance Criteria**:

- [ ] Placeholders appear immediately (never blank)
- [ ] Thumbnails load progressively (visible progress)
- [ ] Full images load in background without blocking scroll
- [ ] No timeout errors or "Failed to load" messages
- [ ] App remains responsive during slow loads
- [ ] Loading indicators show appropriate state

**Screenshot Required**: Yes - loading states on slow network

---

### 3.2 Offline Mode

**Test Scenario**: Verify cached images work offline

**Steps**:

1. Scroll through feed with network enabled (populate cache)
2. Enable airplane mode
3. Navigate away and back to community feed
4. Scroll through previously viewed content

**Acceptance Criteria**:

- [ ] Previously viewed images load from cache instantly
- [ ] Cached thumbnails display correctly
- [ ] No "No Internet" errors for cached content
- [ ] Uncached content shows placeholder with "Offline" indicator
- [ ] App doesn't crash or freeze when offline

**Screenshot Required**: Yes - offline mode with cached vs uncached content

---

### 3.3 Network Interruption

**Test Scenario**: Verify resilience to network interruptions

**Steps**:

1. Start scrolling with network enabled
2. Toggle airplane mode on/off during scroll
3. Observe recovery behavior

**Acceptance Criteria**:

- [ ] In-progress image loads resume after reconnection
- [ ] No duplicate image requests after reconnection
- [ ] Failed loads retry automatically
- [ ] No visual glitches during network transition
- [ ] Toast/banner notification for network status change

**Screenshot Required**: Optional

---

## 4. Memory & Performance Testing

### 4.1 Extended Scroll Memory Test

**Test Scenario**: Verify no memory leaks during extended scrolling

**Steps**:

1. Open Android Profiler or Xcode Instruments
2. Navigate to community feed
3. Scroll continuously for 60 seconds
4. Monitor memory usage graph
5. Stop scrolling and wait 10 seconds
6. Force garbage collection (if possible)

**Acceptance Criteria**:

- [ ] Memory increase during scroll ≤50 MB
- [ ] Memory returns to within ≤10 MB of baseline after GC
- [ ] No continuous memory growth (sawtooth pattern OK)
- [ ] No memory warnings or low memory events
- [ ] App remains responsive after extended scroll

**Screenshot Required**: Yes - memory graph from profiler

---

### 4.2 Image Cache Behavior

**Test Scenario**: Verify expo-image cache works correctly

**Steps**:

1. Clear app cache (reinstall or clear data)
2. Scroll through 100 posts
3. Scroll back to top
4. Observe load times

**Acceptance Criteria**:

- [ ] First view: images load from network
- [ ] Second view: images load instantly from cache
- [ ] Cache persists across app restarts
- [ ] Cache size stays within reasonable bounds (< 100 MB)
- [ ] Old cache entries evicted when cache full

**Screenshot Required**: Optional

---

### 4.3 FlashList Recycling

**Test Scenario**: Verify FlashList recycles cells correctly

**Steps**:

1. Enable "Show Recycled Views" debug option (if available)
2. Scroll through feed rapidly
3. Observe cell recycling behavior

**Acceptance Criteria**:

- [ ] Cells recycle smoothly (no flicker)
- [ ] Images update correctly when cell recycled
- [ ] No "wrong image" displayed in recycled cell
- [ ] Recycling doesn't cause blank cells
- [ ] Performance remains smooth during rapid scroll

**Screenshot Required**: Optional

---

## 5. Edge Cases & Error Handling

### 5.1 Missing Image Variants

**Test Scenario**: Verify fallback for legacy posts without variants

**Steps**:

1. Find or create posts without `media_resized_uri` or `media_thumbnail_uri`
2. View these posts in feed
3. Observe fallback behavior

**Acceptance Criteria**:

- [ ] Original image loads if no variants available
- [ ] No errors or crashes for legacy posts
- [ ] Placeholder still shows while loading
- [ ] Performance acceptable even with large originals
- [ ] Logs indicate fallback to original (for debugging)

**Screenshot Required**: Optional

---

### 5.2 Corrupted/Invalid Images

**Test Scenario**: Verify graceful handling of invalid images

**Steps**:

1. Create posts with invalid image URLs
2. Create posts with corrupted image data
3. View these posts in feed

**Acceptance Criteria**:

- [ ] "Failed to load" placeholder displays
- [ ] No app crashes or freezes
- [ ] User can still interact with post (like, comment)
- [ ] Error logged to Sentry for debugging
- [ ] Retry button available (optional)

**Screenshot Required**: Yes - error state

---

### 5.3 Very Large Images

**Test Scenario**: Verify handling of oversized images

**Steps**:

1. Upload posts with very large images (> 5 MB, > 4000px)
2. View in feed on low-end device (Moto G Play)
3. Monitor performance and memory

**Acceptance Criteria**:

- [ ] Images downscaled appropriately (not full resolution)
- [ ] No out-of-memory crashes
- [ ] Loading time reasonable (< 5s on WiFi)
- [ ] Image quality acceptable after downscaling
- [ ] Memory usage stays within budget

**Screenshot Required**: Optional

---

### 5.4 Mixed Content Types

**Test Scenario**: Verify feed with mixed content renders correctly

**Steps**:

1. Scroll through feed with:
   - Text-only posts
   - Single image posts
   - Multiple image posts
   - Video posts (if supported)
2. Observe rendering consistency

**Acceptance Criteria**:

- [ ] All post types render correctly
- [ ] Spacing/layout consistent across types
- [ ] No layout shift when images load
- [ ] FlashList `getItemType` working correctly
- [ ] Performance smooth with heterogeneous content

**Screenshot Required**: Yes - mixed content feed

---

## 6. User Experience Testing

### 6.1 Scroll Smoothness

**Test Scenario**: Subjective smoothness evaluation

**Steps**:

1. Scroll through feed at various speeds
2. Test on all target devices
3. Compare with competitor apps (Instagram, Twitter)

**Acceptance Criteria**:

- [ ] Scroll feels smooth and responsive (60 FPS)
- [ ] No stuttering or jank during scroll
- [ ] Comparable to or better than competitor apps
- [ ] Smooth on low-end devices (Moto G Play)
- [ ] No "rubber banding" or scroll lag

**Screenshot Required**: No - subjective feel

---

### 6.2 Image Transition Quality

**Test Scenario**: Evaluate visual quality of image transitions

**Steps**:

1. Scroll slowly through feed
2. Observe placeholder → thumbnail → full image transitions
3. Rate transition smoothness

**Acceptance Criteria**:

- [ ] Transitions are smooth (no "pop")
- [ ] No color shift during transition
- [ ] No visible seams or artifacts
- [ ] Transition timing feels natural (not too fast/slow)
- [ ] Consistent across all image types

**Screenshot Required**: Optional - video recording preferred

---

### 6.3 Accessibility

**Test Scenario**: Verify accessibility with screen reader

**Steps**:

1. Enable TalkBack (Android) or VoiceOver (iOS)
2. Navigate through feed
3. Test image descriptions

**Acceptance Criteria**:

- [ ] Images have meaningful alt text
- [ ] Loading states announced to screen reader
- [ ] Error states announced clearly
- [ ] Navigation remains accessible
- [ ] Focus order logical

**Screenshot Required**: No

---

## 7. Design Review Sign-Off

### 7.1 Visual Consistency

**Reviewer**: [Design Lead Name]  
**Date**: \***\*\_\_\_\*\***

- [ ] Placeholder colors match design system
- [ ] Image borders/shadows correct
- [ ] Spacing and layout approved
- [ ] Dark mode appearance approved
- [ ] Loading states match design spec

**Comments**:

```
[Design feedback here]
```

---

### 7.2 Performance Acceptance

**Reviewer**: [QA Lead Name]  
**Date**: \***\*\_\_\_\*\***

- [ ] All manual tests passed
- [ ] No critical bugs found
- [ ] Performance meets SLA (58+ FPS)
- [ ] Memory usage within budget
- [ ] Ready for production release

**Comments**:

```
[QA feedback here]
```

---

## 8. Test Results Documentation

### Test Execution Summary

**Test Date**: \***\*\_\_\_\*\***  
**Tester**: \***\*\_\_\_\*\***  
**Build Version**: \***\*\_\_\_\*\***  
**Devices Tested**:

- [ ] Pixel 6a (Android 14)
- [ ] Moto G Play (Android 13)
- [ ] iPhone 12 (iOS 17)

**Test Results**:

- Total Checks: **\_** / **\_**
- Passed: **\_**
- Failed: **\_**
- Blocked: **\_**

**Critical Issues Found**:

```
1. [Issue description]
2. [Issue description]
```

**Screenshots Attached**:

- [ ] BlurHash transitions
- [ ] Dark mode placeholders
- [ ] Slow network loading
- [ ] Memory profiler graph
- [ ] Error states
- [ ] Mixed content feed

---

## 9. Regression Testing (Future Releases)

### Quick Smoke Test (5 minutes)

For future releases, verify these critical items:

- [ ] Placeholders appear (no blank cells)
- [ ] Images load in feed
- [ ] Dark mode works
- [ ] Offline cache works
- [ ] No crashes during scroll

### Full Regression (30 minutes)

Run full checklist quarterly or after major changes to:

- Image handling code
- FlashList implementation
- Network layer
- Cache management

---

## Appendix A: Test Data Setup

### Seeding Test Database

```bash
# TODO: Create data seeding script
# pnpm run test:seed-community --posts=1000 --images=mixed

# Manual seeding:
# 1. Create 1000 posts via Supabase dashboard
# 2. Mix of text-only (30%), single image (50%), multiple images (20%)
# 3. Vary image sizes: small (< 500KB), medium (500KB-2MB), large (2MB-5MB)
# 4. Include some legacy posts without variants
```

### Network Simulation

**Android**:

```bash
# Enable slow 3G
adb shell settings put global network_speed 3g
adb shell settings put global network_latency 750

# Disable (reset to normal)
adb shell settings delete global network_speed
adb shell settings delete global network_latency
```

**iOS**:

- Use Network Link Conditioner in Settings → Developer

---

## Appendix B: Performance Metrics Collection

### Android Perfetto Trace

```bash
# Start trace
adb shell perfetto -c - --txt -o /data/misc/perfetto-traces/trace <<EOF
buffers: {
  size_kb: 63488
  fill_policy: DISCARD
}
data_sources: {
  config {
    name: "linux.ftrace"
    ftrace_config {
      ftrace_events: "sched/sched_switch"
      ftrace_events: "power/suspend_resume"
      ftrace_events: "sched/sched_wakeup"
      ftrace_events: "sched/sched_waking"
      ftrace_events: "sched/sched_blocked_reason"
      ftrace_events: "sched/sched_cpu_hotplug"
      atrace_apps: "com.growbro.app"
      atrace_categories: "gfx"
      atrace_categories: "view"
      atrace_categories: "webview"
      atrace_categories: "camera"
      atrace_categories: "input"
      atrace_categories: "res"
    }
  }
}
duration_ms: 60000
EOF

# Run test, then pull trace
adb pull /data/misc/perfetto-traces/trace perfetto-trace.pb

# Open in https://ui.perfetto.dev
```

### iOS Instruments

1. Open Xcode → Instruments
2. Select "Time Profiler" or "Allocations"
3. Attach to GrowBro app
4. Run scroll test
5. Export trace for analysis

---

## Appendix C: Known Issues & Workarounds

### Issue: expo-image cache not clearing

**Workaround**: Reinstall app or use `expo-image` cache clear API

### Issue: BlurHash appears pixelated on some devices

**Workaround**: Increase BlurHash resolution in generation (4x4 → 6x6)

### Issue: Memory leak on Android < 13

**Workaround**: Force GC after every 100 scrolled items

---

## Sign-Off

**Task 5 Complete**: ☐

**Signed by**:

- Design Lead: \***\*\_\_\_\*\*** Date: \***\*\_\_\_\*\***
- QA Lead: \***\*\_\_\_\*\*** Date: \***\*\_\_\_\*\***
- Engineering Lead: \***\*\_\_\_\*\*** Date: \***\*\_\_\_\*\***

**Notes**:

```
[Final sign-off comments]
```
