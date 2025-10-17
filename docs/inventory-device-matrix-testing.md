# Inventory Device Matrix Testing Guide

> GrowBro is an educational app for home cannabis cultivation. It never facilitates shopping, pickup, delivery, or any transaction.

## Overview

This document outlines the device matrix testing requirements for the Inventory and Consumables feature, focusing on notification behavior, exact alarm permissions, and cross-OEM compatibility.

**Requirements:** 4.2, 7.4, 11.2

## Test Devices

### Android Devices

#### Minimum Configuration

- **Pixel 6-class device** (mid-tier)
  - Android 13+
  - 8GB RAM
  - Snapdragon 778G or equivalent
  - Target for performance benchmarks

#### Samsung Devices

- **Samsung Galaxy S22** or newer
  - Android 13+ with One UI
  - Test for notification behavior differences
  - Verify exact alarm permission UI variations

### iOS Devices (Reference)

- **iPhone 12** or newer
  - iOS 15+
  - Background fetch limitations noted

## Android 13+ Exact Alarm Permission Tests

### Requirement 4.2: Low Stock Notifications

#### Test Cases

##### TC-ALARM-001: Permission Request Flow

**Preconditions:**

- Fresh app install
- Android 13+ device
- Location: Settings → Apps → Special app access → Alarms & reminders

**Steps:**

1. Launch app
2. Navigate to Inventory
3. Create item with low stock threshold
4. Observe permission request dialog

**Expected Results:**

- Permission dialog appears with clear justification
- "Allow" option grants SCHEDULE_EXACT_ALARM
- "Deny" option triggers fallback to inexact alarms
- Telemetry records permission state

**Devices:** Pixel 6, Samsung Galaxy S22

##### TC-ALARM-002: Permission Grant Success

**Steps:**

1. Complete TC-ALARM-001 with "Allow"
2. Set item stock below threshold
3. Wait for notification

**Expected Results:**

- Notification delivered within 1 minute of threshold breach
- Badge appears on inventory tab
- Telemetry records scheduled-vs-delivered delta (<60s)

**Devices:** Pixel 6, Samsung Galaxy S22

##### TC-ALARM-003: Permission Denied Fallback

**Steps:**

1. Complete TC-ALARM-001 with "Deny"
2. Set item stock below threshold
3. Observe in-app banner
4. Check notification delivery

**Expected Results:**

- In-app banner shows "Exact alarms disabled - notifications may be delayed"
- Inexact alarm scheduled as fallback
- Notification delivered within 15 minutes
- Telemetry records permission denial

**Devices:** Pixel 6, Samsung Galaxy S22

##### TC-ALARM-004: Permission Revocation

**Steps:**

1. Grant permission via TC-ALARM-002
2. Revoke permission in system settings
3. Trigger low stock condition
4. Relaunch app

**Expected Results:**

- App detects revocation on next launch
- Auto-downgrade to inexact alarms
- In-app banner prompts to re-enable
- Telemetry records permission state change

**Devices:** Pixel 6, Samsung Galaxy S22

##### TC-ALARM-005: Cross-OEM Consistency

**Steps:**

1. Run TC-ALARM-001 on Pixel 6
2. Run TC-ALARM-001 on Samsung Galaxy S22
3. Compare permission UI and behavior

**Expected Results:**

- Both devices show system permission dialog
- Samsung may have additional One UI screens
- Notification delivery timing within ±30s variance
- Both record same telemetry events

**Devices:** Pixel 6 vs Samsung Galaxy S22

### Requirement 11.2: Notification Telemetry

#### Test Cases

##### TC-TELEMETRY-001: Delivered vs Scheduled Delta

**Steps:**

1. Enable exact alarms
2. Create item with min_stock=10
3. Set stock to 9 units
4. Record scheduled_at timestamp
5. Observe notification
6. Record delivered_at timestamp

**Expected Results:**

- Delta = delivered_at - scheduled_at
- With exact alarms: Delta < 60 seconds
- With inexact alarms: Delta < 900 seconds (15 min)
- Telemetry includes both timestamps

**Devices:** Pixel 6, Samsung Galaxy S22

**Metrics to Record:**

```json
{
  "event": "notification_delivered",
  "notification_type": "low_stock",
  "scheduled_at": "2025-10-16T10:00:00Z",
  "delivered_at": "2025-10-16T10:00:15Z",
  "delta_seconds": 15,
  "permission_state": "granted",
  "alarm_type": "exact",
  "device_manufacturer": "Google",
  "device_model": "Pixel 6",
  "android_version": "13"
}
```

##### TC-TELEMETRY-002: Permission State Tracking

**Steps:**

1. Track permission state on app launch
2. Grant permission
3. Revoke permission
4. Re-grant permission

**Expected Results:**

- Telemetry records each state change
- Events include timestamp, previous state, new state
- Pre-check results logged before permission request

**Metrics:**

```json
{
  "event": "alarm_permission_change",
  "timestamp": "2025-10-16T10:05:00Z",
  "previous_state": "denied",
  "new_state": "granted",
  "trigger": "user_action"
}
```

##### TC-TELEMETRY-003: OEM-Specific Variance

**Steps:**

1. Run TC-TELEMETRY-001 on Pixel 6 (5 trials)
2. Run TC-TELEMETRY-001 on Samsung Galaxy S22 (5 trials)
3. Calculate mean and standard deviation of deltas

**Expected Results:**

- Pixel 6: Mean delta < 30s, StdDev < 15s
- Samsung: Mean delta < 60s, StdDev < 30s
- Document variance in telemetry
- Flag outliers (>2 StdDev) for investigation

**Analysis:**

```
Pixel 6 Results:
- Mean: 18s
- StdDev: 8s
- Min: 5s, Max: 35s

Samsung S22 Results:
- Mean: 42s
- StdDev: 22s
- Min: 15s, Max: 90s
```

## Performance Testing

### Requirement 11.2: Performance Benchmarks

#### Test Cases

##### TC-PERF-001: Large Dataset Load Time

**Preconditions:**

- 1,000 inventory items in database
- Cold start (app not in memory)
- Mid-tier device (Pixel 6-class)

**Steps:**

1. Force stop app
2. Clear memory cache (don't clear data)
3. Launch app
4. Navigate to inventory list
5. Measure time until FlashList renders

**Expected Results:**

- Load time < 300ms
- Scrolling at 60fps (monitored via performance overlay)
- No dropped frames during initial render

**Devices:** Pixel 6, Samsung Galaxy S22

**Metrics:**

```json
{
  "event": "inventory_list_load",
  "item_count": 1000,
  "load_time_ms": 285,
  "fps_avg": 60,
  "dropped_frames": 0,
  "device_model": "Pixel 6"
}
```

##### TC-PERF-002: Scrolling Performance

**Preconditions:**

- 1,000+ items loaded
- Enable performance overlay (React Native DevTools)

**Steps:**

1. Scroll rapidly through list
2. Monitor FPS counter
3. Record dropped frames

**Expected Results:**

- Sustained 60fps during scrolling
- Max 1-2 dropped frames per 100 frames
- No visible jank or stuttering

**Devices:** Pixel 6

##### TC-PERF-003: Memory Usage

**Steps:**

1. Launch app
2. Load 1,000 items
3. Scroll entire list
4. Monitor memory via Android Studio Profiler

**Expected Results:**

- Peak memory < 150MB for inventory feature
- No memory leaks after scrolling
- GC pauses < 16ms (1 frame budget)

**Devices:** Pixel 6

## Offline and Sync Testing

### Requirement 7.4: Flight Mode Workflow

#### Test Cases

##### TC-OFFLINE-001: Complete Flight Mode Workflow

**Steps:**

1. Enable airplane mode
2. Create inventory item
3. Add batch to item
4. Consume via task
5. Verify local state
6. Disable airplane mode
7. Trigger sync
8. Verify server state

**Expected Results:**

- All operations succeed offline
- Local WatermelonDB reflects changes immediately
- Sync queue populated with 3 mutations
- Sync completes within 10 seconds
- Server state matches local state
- No data loss or conflicts

**Devices:** Pixel 6, Samsung Galaxy S22

##### TC-OFFLINE-002: Sync Failure Recovery

**Steps:**

1. Create item offline
2. Enable network
3. Simulate server error (502)
4. Observe retry behavior

**Expected Results:**

- App retries with exponential backoff
- User sees "Sync pending" indicator
- No data loss
- Successful sync on next retry

**Devices:** Pixel 6

## Conflict Resolution Testing

### Requirement 7.2: Last-Write-Wins

#### Test Cases

##### TC-CONFLICT-001: Multi-Device Edit Conflict

**Setup:**

- Two devices (Device A, Device B)
- Same user account
- Both offline initially

**Steps:**

1. Device A: Edit item name to "Name A"
2. Device B: Edit item name to "Name B"
3. Device A: Go online and sync (succeeds)
4. Device B: Go online and sync (conflict)

**Expected Results:**

- Device B receives conflict toast
- Toast shows: "Last write wins; your change overwritten by Device A at <timestamp>"
- "Reapply my change" button creates new write
- Telemetry records conflict

**Devices:** Pixel 6 (Device A), Samsung Galaxy S22 (Device B)

## Notification Behavior Across OEMs

### Samsung One UI Specifics

#### Observed Differences

- Additional permission screens for "Allow all the time"
- Battery optimization prompt may interfere
- Notification channels require manual configuration
- Exact alarm UI shows in "Special access" menu

#### Test Cases

##### TC-OEM-SAMSUNG-001: One UI Permission Flow

**Steps:**

1. Fresh install on Samsung device
2. Request exact alarm permission
3. Document additional screens

**Expected Results:**

- Permission granted after all One UI prompts
- App handles additional screens gracefully
- Telemetry includes One UI version

**Devices:** Samsung Galaxy S22

##### TC-OEM-SAMSUNG-002: Battery Optimization Conflict

**Steps:**

1. Enable exact alarms
2. System suggests battery optimization
3. Observe notification delivery

**Expected Results:**

- Notifications still delivered if exact alarms granted
- Battery optimization doesn't override alarm permission
- Document in user-facing help content

**Devices:** Samsung Galaxy S22

## Test Execution Schedule

### Phase 1: Core Functionality (Week 1)

- TC-ALARM-001 through TC-ALARM-005
- TC-PERF-001 through TC-PERF-003
- TC-OFFLINE-001, TC-OFFLINE-002

### Phase 2: Telemetry & Metrics (Week 2)

- TC-TELEMETRY-001 through TC-TELEMETRY-003
- Aggregate OEM variance data
- Tune notification timing thresholds

### Phase 3: Edge Cases & OEM-Specific (Week 3)

- TC-CONFLICT-001
- TC-OEM-SAMSUNG-001, TC-OEM-SAMSUNG-002
- Regression testing on both devices

## Pass/Fail Criteria

### Critical (Must Pass)

- Notifications deliver within SLA (exact: 60s, inexact: 15min)
- No data loss in offline workflows
- Performance benchmarks met on mid-tier device
- Permission flow completes on all devices

### Major (Should Pass)

- Telemetry captures all key events
- Conflict resolution UI functional
- OEM-specific quirks documented

### Minor (Nice to Have)

- Notification delta variance < 30s across OEMs
- Memory usage optimal (<100MB)
- Battery impact minimal

## Known Issues and Workarounds

### Android 13 Samsung Devices

**Issue:** Exact alarm permission request shows twice
**Workaround:** Handle duplicate grant/deny events via debouncing
**Tracking:** Issue #1234

### Pixel 6 Emulator

**Issue:** Inexact alarms fire immediately in emulator
**Workaround:** Test on physical device for accurate timing
**Tracking:** Known Android emulator limitation

## Appendix: Telemetry Event Schema

### Notification Events

```typescript
interface NotificationEvent {
  event:
    | 'notification_scheduled'
    | 'notification_delivered'
    | 'notification_opened';
  notification_type: 'low_stock';
  item_id: string;
  scheduled_at: string; // ISO 8601
  delivered_at?: string; // ISO 8601
  delta_seconds?: number;
  permission_state: 'granted' | 'denied' | 'not_determined';
  alarm_type: 'exact' | 'inexact' | 'none';
  device_manufacturer: string;
  device_model: string;
  android_version: string;
}
```

### Permission Events

```typescript
interface PermissionEvent {
  event: 'alarm_permission_requested' | 'alarm_permission_change';
  timestamp: string; // ISO 8601
  previous_state?: 'granted' | 'denied' | 'not_determined';
  new_state: 'granted' | 'denied' | 'not_determined';
  trigger: 'app_launch' | 'user_action' | 'system_revoke';
}
```

### Performance Events

```typescript
interface PerformanceEvent {
  event: 'inventory_list_load';
  item_count: number;
  load_time_ms: number;
  fps_avg: number;
  dropped_frames: number;
  device_model: string;
  memory_peak_mb?: number;
}
```

## Test Sign-Off

**Tester:** **\*\*\*\***\_**\*\*\*\***  
**Date:** **\*\*\*\***\_**\*\*\*\***  
**Devices Tested:**

- [ ] Pixel 6 (Android 13)
- [ ] Samsung Galaxy S22 (Android 13 / One UI)

**Results Summary:**

- Critical: \_**\_ / \_\_** passed
- Major: \_**\_ / \_\_** passed
- Minor: \_**\_ / \_\_** passed

**Notes:** ****\*\*****\*\*****\*\*****\_****\*\*****\*\*****\*\*****
