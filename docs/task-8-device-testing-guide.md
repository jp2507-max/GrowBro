# Task 8: Stock Monitoring - Device Testing Guide

## Test Devices

### Primary Devices

- **Google Pixel 6** (Android 13)
- **Samsung Galaxy S21** (Android 14)

### Test Scope

- Low-stock notification scheduling
- Android 13+ exact alarm permission flow
- Permission fallback behavior
- Notification delivery timing
- Dark mode compatibility

## Manual QA Checklist

### Pre-Test Setup

- [ ] Install debug build on both devices
- [ ] Enable developer options
- [ ] Disable battery optimization for GrowBro
- [ ] Set system time to correct timezone
- [ ] Clear app data for fresh state

### Test 1: Permission Flow (Android 13+)

**Device:** Pixel 6, Galaxy S21

1. Create inventory item with stock below minimum
   - [ ] Permission sheet appears immediately
   - [ ] "Why this matters" section is clear
   - [ ] "Enable Notifications" button works
   - [ ] Android system dialog appears

2. Grant permission
   - [ ] Permission granted successfully
   - [ ] No error messages shown
   - [ ] Notification scheduled within 1 second

3. Deny permission (fresh install)
   - [ ] Fallback banner appears at top of inventory screen
   - [ ] Banner shows warning icon (⚠️)
   - [ ] "Open Settings" link works
   - [ ] Tapping opens app settings correctly

### Test 2: Notification Scheduling

**Devices:** Both

1. Item at 50% below minimum
   - [ ] Notification scheduled immediately
   - [ ] Notification appears in system tray
   - [ ] Title: "Low stock: [Item Name]"
   - [ ] Body includes current stock amount
   - [ ] Body includes days-to-zero (if available)

2. Item at 90% below minimum
   - [ ] Notification marked as critical urgency
   - [ ] Appears higher in notification list

3. Multiple low-stock items
   - [ ] Each gets separate notification
   - [ ] All notifications appear in tray
   - [ ] No duplicate notifications

### Test 3: Notification Interaction

**Devices:** Both

1. Tap notification from system tray
   - [ ] App opens to item detail screen
   - [ ] Correct item is displayed
   - [ ] No crash or error

2. Swipe to dismiss notification
   - [ ] Notification removed from tray
   - [ ] App state unaffected

### Test 4: Exact vs Inexact Alarms

**Device:** Pixel 6

1. With exact alarm permission
   - [ ] Notification appears within 1-2 seconds
   - [ ] System logs show exact alarm used

2. Without exact alarm permission
   - [ ] Notification appears within 15 minutes
   - [ ] Body text includes "(may be delayed)"
   - [ ] No app crashes

### Test 5: Dark Mode

**Devices:** Both

1. Enable system dark mode
   - [ ] Permission sheet uses dark theme
   - [ ] Fallback banner uses dark theme
   - [ ] Notification channel respects system theme
   - [ ] All text is readable

2. Toggle dark mode while app open
   - [ ] UI updates immediately
   - [ ] No visual glitches

### Test 6: Forecast Accuracy Display

**Devices:** Both

1. Item with consumption history (≥12 weeks)
   - [ ] Consumption trend chart displays
   - [ ] Weekly data points visible
   - [ ] Chart animations smooth (< 16ms frames)
   - [ ] Reorder recommendation card shows

2. High confidence forecast
   - [ ] Green "High" confidence pill
   - [ ] Recommended quantity displayed
   - [ ] Days until reorder calculated

3. Low confidence forecast
   - [ ] Red "Low" confidence pill
   - [ ] Warning note about limited data
   - [ ] Recommendation still provided

### Test 7: Edge Cases

**Devices:** Both

1. No network connection
   - [ ] Local notifications still work
   - [ ] No error messages shown
   - [ ] Telemetry queued for later

2. App in background
   - [ ] Notifications still delivered
   - [ ] Timing accuracy maintained

3. System notification settings disabled
   - [ ] Graceful degradation
   - [ ] In-app warning shown

## Performance Benchmarks

### Notification Scheduling

- **Target:** < 50ms to schedule notification
- **Test:** Time from low-stock detection to notification scheduled
- **Tools:** React Native Performance Monitor

### Chart Rendering

- **Target:** < 100ms to render consumption chart
- **Test:** Time to render 8 weeks of data
- **Tools:** React DevTools Profiler

### Permission Flow

- **Target:** < 200ms from button tap to system dialog
- **Test:** Time from "Enable" tap to Android permission dialog
- **Tools:** React Native Performance Monitor

## Bug Report Template

```
**Device:** [Pixel 6 / Galaxy S21]
**Android Version:** [13 / 14]
**App Version:** [from package.json]
**Steps to Reproduce:**
1.
2.
3.

**Expected Behavior:**

**Actual Behavior:**

**Screenshots:**

**Logs:**
```

## Test Results Format

### Pass Criteria

- All primary test cases pass on both devices
- No crashes or ANR (Application Not Responding)
- Performance targets met
- Dark mode displays correctly
- Permission flows work as expected

### Document Results

For each test device, record:

- Test date
- Pass/fail for each checklist item
- Performance measurements
- Any bugs discovered
- Screenshots of key flows

Save results in `docs/task-8-device-testing-results.md`
