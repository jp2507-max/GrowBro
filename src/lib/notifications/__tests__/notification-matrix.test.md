# Notification Matrix Testing Guide

This document outlines the manual testing matrix for playbook notifications across different devices and power states to achieve ≥95% delivery within ±5 minutes.

## Test Devices

### Android

- **Pixel 6** (Android 14) - Latest OS with strict battery optimization
- **Moto G Power** (Android 12) - Mid-tier device with aggressive battery management
- **Samsung Galaxy A53** (Android 13) - Popular mid-range device

### iOS

- **iPhone SE (2022)** - Budget device with A15 chip
- **iPhone 13** - Standard device
- **iPhone 14 Pro** - Latest flagship

## Test Scenarios

### 1. Normal Operation (Screen On, App Active)

**Expected Result:** 100% delivery within 1 second

| Device    | Test Date | Scheduled | Delivered | Delay | Pass/Fail |
| --------- | --------- | --------- | --------- | ----- | --------- |
| Pixel 6   |           |           |           |       |           |
| Moto G    |           |           |           |       |           |
| iPhone SE |           |           |           |       |           |
| iPhone 13 |           |           |           |       |           |

### 2. Screen Off, App Background

**Expected Result:** ≥95% delivery within ±5 minutes

| Device    | Test Date | Scheduled | Delivered | Delay | Pass/Fail |
| --------- | --------- | --------- | --------- | ----- | --------- |
| Pixel 6   |           |           |           |       |           |
| Moto G    |           |           |           |       |           |
| iPhone SE |           |           |           |       |           |
| iPhone 13 |           |           |           |       |           |

### 3. Doze Mode (Android) / Low Power Mode (iOS)

**Expected Result:** ≥95% delivery within ±5 minutes

| Device    | Test Date | Scheduled | Delivered | Delay | Pass/Fail |
| --------- | --------- | --------- | --------- | ----- | --------- |
| Pixel 6   |           |           |           |       |           |
| Moto G    |           |           |           |       |           |
| iPhone SE |           |           |           |       |           |
| iPhone 13 |           |           |           |       |           |

**Android Doze Setup:**

```bash
# Force device into Doze mode
adb shell dumpsys deviceidle force-idle

# Check Doze state
adb shell dumpsys deviceidle get deep

# Exit Doze mode
adb shell dumpsys deviceidle unforce
```

**iOS Low Power Mode:**

- Settings → Battery → Low Power Mode → ON

### 4. Battery Saver Mode

**Expected Result:** ≥90% delivery within ±10 minutes (degraded but acceptable)

| Device    | Test Date | Scheduled | Delivered | Delay | Pass/Fail |
| --------- | --------- | --------- | --------- | ----- | --------- |
| Pixel 6   |           |           |           |       |           |
| Moto G    |           |           |           |       |           |
| iPhone SE |           |           |           |       |           |
| iPhone 13 |           |           |           |       |           |

### 5. Airplane Mode → Network Restored

**Expected Result:** Notifications delivered within 1 minute of network restoration

| Device    | Test Date | Scheduled | Delivered | Delay | Pass/Fail |
| --------- | --------- | --------- | --------- | ----- | --------- |
| Pixel 6   |           |           |           |       |           |
| Moto G    |           |           |           |       |           |
| iPhone SE |           |           |           |       |           |
| iPhone 13 |           |           |           |       |           |

### 6. App Force Stopped (Android)

**Expected Result:** Notifications still delivered via WorkManager

| Device  | Test Date | Scheduled | Delivered | Delay | Pass/Fail |
| ------- | --------- | --------- | --------- | ----- | --------- |
| Pixel 6 |           |           |           |       |           |
| Moto G  |           |           |           |       |           |

**Force Stop:**

```bash
adb shell am force-stop com.growbro.app
```

### 7. Multiple Notifications (Batch)

**Expected Result:** All notifications delivered, properly grouped

| Device    | Count | Test Date | All Delivered | Grouped | Pass/Fail |
| --------- | ----- | --------- | ------------- | ------- | --------- |
| Pixel 6   | 10    |           |               |         |           |
| Moto G    | 10    |           |               |         |           |
| iPhone SE | 10    |           |               |         |           |
| iPhone 13 | 10    |           |               |         |           |

### 8. Recurring Notifications

**Expected Result:** Next occurrence scheduled after delivery

| Device    | Pattern | Test Date | Occurrences | Rescheduled | Pass/Fail |
| --------- | ------- | --------- | ----------- | ----------- | --------- |
| Pixel 6   | Daily   |           |             |             |           |
| Moto G    | Weekly  |           |             |             |           |
| iPhone SE | Daily   |           |             |             |           |
| iPhone 13 | Weekly  |           |             |             |           |

## Test Procedure

### Setup

1. Install app on test device
2. Login and create test plant
3. Apply playbook to generate tasks
4. Enable notification permissions
5. Configure exact alarms (Android 12+)

### Execution

1. Schedule notification for 5 minutes in future
2. Put device in test state (Doze, Low Power, etc.)
3. Record scheduled time
4. Wait for notification
5. Record delivery time
6. Calculate delay
7. Verify notification content
8. Check if next occurrence scheduled (recurring)

### Verification

```typescript
// Automated verification helper
async function verifyNotificationDelivery(
  notificationId: string,
  scheduledTime: Date,
  deliveredTime: Date
): Promise<TestResult> {
  const delayMs = deliveredTime.getTime() - scheduledTime.getTime();
  const delayMinutes = delayMs / 60000;

  return {
    notificationId,
    scheduledTime,
    deliveredTime,
    delayMs,
    delayMinutes,
    withinTolerance: Math.abs(delayMinutes) <= 5,
    passed: Math.abs(delayMinutes) <= 5,
  };
}
```

## Success Criteria

### Overall Metrics

- **Delivery Rate:** ≥95% of notifications delivered
- **Timing Accuracy:** ≥95% within ±5 minutes
- **Doze Mode:** ≥90% delivery (acceptable degradation)
- **Battery Saver:** ≥85% delivery (acceptable degradation)

### Per-Device Requirements

- Each device must pass ≥90% of test scenarios
- Critical scenarios (Normal, Background) must have 100% pass rate
- Degraded scenarios (Doze, Battery Saver) must have ≥85% pass rate

## Troubleshooting

### Android Issues

**Notifications not delivered in Doze:**

- Check WorkManager fallback is configured
- Verify app is not battery optimized
- Check notification channels are created
- Verify exact alarm permission granted

**Notifications delayed:**

- Check if device has aggressive battery optimization
- Verify inexact alarms are used by default
- Check WorkManager constraints

### iOS Issues

**Notifications not delivered:**

- Verify notification permissions granted
- Check notification categories are registered
- Verify trigger dates are in future
- Check for iOS notification limits

**Notifications delayed in Low Power Mode:**

- Expected behavior - iOS delays background tasks
- Verify notifications still delivered within tolerance

## Automated Testing

```typescript
// Example automated test
describe('Notification Matrix - Automated', () => {
  it('should deliver notifications within tolerance', async () => {
    const scheduler = getPlaybookNotificationScheduler();
    const task = {
      id: 'test-task',
      title: 'Test Notification',
      reminderAtUtc: new Date(Date.now() + 60000).toISOString(),
      timezone: 'America/Los_Angeles',
    };

    const result = await scheduler.scheduleTaskReminder(task);
    expect(result.notificationId).toBeDefined();

    // Wait for delivery
    await waitFor(
      () => {
        const stats = scheduler.getDeliveryStats();
        expect(stats.totalDelivered).toBeGreaterThan(0);
      },
      { timeout: 70000 } // 70 seconds
    );

    // Verify timing
    const verified = await scheduler.verifyDelivery(result.notificationId);
    expect(verified).toBe(true);
  });
});
```

## Reporting

### Test Report Template

```markdown
# Notification Matrix Test Report

**Date:** [Date]
**Tester:** [Name]
**App Version:** [Version]

## Summary

- Total Tests: [Count]
- Passed: [Count]
- Failed: [Count]
- Pass Rate: [Percentage]

## Device Results

[Table with per-device results]

## Issues Found

1. [Issue description]
2. [Issue description]

## Recommendations

1. [Recommendation]
2. [Recommendation]
```

## Continuous Monitoring

Set up automated monitoring in production:

```typescript
// Analytics events
analytics.track('notification_scheduled', {
  notificationId,
  scheduledTime,
  taskId,
  exact: useExactAlarm,
});

analytics.track('notification_delivered', {
  notificationId,
  deliveredTime,
  delayMs,
  withinTolerance,
});

// Daily summary
analytics.track('notification_delivery_summary', {
  date,
  totalScheduled,
  totalDelivered,
  deliveryRate,
  averageDelayMs,
  withinToleranceCount,
});
```
