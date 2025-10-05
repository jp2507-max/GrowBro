# Android Notification System Guide

## Overview

This guide documents the Android notification system implementation for the GrowBro playbook feature, covering Android 13+ permission flows, Android 14 exact-alarm policies, and Doze mode handling.

## Android 13+ (API 33+) Permission Flow

### Runtime Permission Required

Starting with Android 13 (API 33), apps must request the `POST_NOTIFICATIONS` permission at runtime to display notifications.

### Permission Request Flow

1. **Check Permission Status**

   ```typescript
   const granted = await PermissionManager.isNotificationPermissionGranted();
   ```

2. **Request Permission**

   ```typescript
   const result = await PermissionManager.requestNotificationPermission();
   // result: 'granted' | 'denied' | 'error'
   ```

3. **Handle Permission Denial**
   - If denied, notifications will not be displayed
   - User must manually enable in system settings
   - Provide in-app guidance to settings

### Best Practices

- Request permission in context (e.g., when user applies a playbook)
- Explain why notifications are needed before requesting
- Provide fallback UI for users who deny permission
- Don't repeatedly request if user has denied

## Android 14+ (API 34+) Exact Alarm Policy

### SCHEDULE_EXACT_ALARM Permission

Android 14 introduced stricter controls for exact alarms. Apps must:

1. Declare `SCHEDULE_EXACT_ALARM` permission in manifest
2. Request permission at runtime for critical alarms
3. Justify the need for exact timing

### When to Use Exact Alarms

**Use exact alarms for:**

- Critical cultivation tasks (e.g., watering in specific time windows)
- Time-sensitive reminders (within 6 hours)

**Don't use exact alarms for:**

- General reminders
- Non-critical notifications
- Tasks with flexible timing

### Implementation

```typescript
// Check if exact alarms are available
const canUseExact = await scheduler.canUseExactAlarms();

// Schedule with exact alarm opt-in
const result = await scheduler.scheduleTaskReminder(task, {
  useExactAlarm: true, // Only for critical tasks
  priority: 'high',
});

// Result indicates if exact alarm was granted
if (result.exact) {
  // Exact alarm scheduled
} else if (result.fallbackUsed) {
  // Fell back to inexact alarm
}
```

### Exact Alarm Threshold

The system uses a 6-hour threshold for exact alarms:

- Reminders within 6 hours: May request exact alarm
- Reminders beyond 6 hours: Use inexact alarms

### User Experience

- Default to inexact alarms for better battery life
- Only request exact alarms when justified
- Inform users when exact alarms are used
- Provide option to disable exact alarms in settings

## Doze Mode Handling

### What is Doze Mode?

Doze mode is Android's battery optimization feature that restricts:

- Network access
- Wake locks
- Alarms (except exact alarms)
- Background services

### Doze Mode Strategies

#### 1. Inexact Alarms (Default)

Inexact alarms are batched and may be delayed during Doze:

- Delivery within ±15 minutes typical
- Better battery life
- Suitable for most reminders

```typescript
// Default behavior - uses inexact alarms
await scheduler.scheduleTaskReminder(task);
```

#### 2. Exact Alarms (Opt-in)

Exact alarms fire even in Doze mode:

- Delivery within ±5 minutes target
- Higher battery impact
- Requires SCHEDULE_EXACT_ALARM permission

```typescript
// Opt-in to exact alarms for critical tasks
await scheduler.scheduleTaskReminder(task, {
  useExactAlarm: true,
});
```

#### 3. WorkManager Fallback

For tasks that must execute during Doze:

- Use WorkManager for guaranteed execution
- Runs when device exits Doze
- Suitable for sync operations

### Testing Doze Mode

```bash
# Enable Doze mode
adb shell dumpsys deviceidle force-idle

# Exit Doze mode
adb shell dumpsys deviceidle unforce

# Check Doze state
adb shell dumpsys deviceidle get deep
```

## Notification Channels

### Required Channels

The app creates these notification channels on startup:

1. **cultivation.reminders** (High importance)
   - Task reminders
   - Watering alerts
   - Feeding schedules
   - Sound enabled
   - Vibration pattern: [0, 250, 250, 250]

2. **community.interactions** (Default importance)
   - Comments
   - Mentions
   - Replies

3. **community.likes** (Low importance)
   - Likes
   - Reactions

4. **system.updates** (Default importance)
   - App updates
   - System notifications

### Channel Management

```typescript
// Ensure channels are created (call on app startup)
await scheduler.ensureChannels();

// Channels are versioned (e.g., cultivation.reminders.v1)
// This allows updates without affecting existing channels
```

### User Control

Users can customize channels in system settings:

- Importance level
- Sound
- Vibration
- LED color
- Show on lock screen

## Notification Rehydration

### Why Rehydration?

Notifications may be lost when:

- App is force-stopped
- Device reboots
- System clears notification queue

### Rehydration Process

```typescript
// On app startup, rehydrate notifications from database
const tasks = await database.getTasks();
await scheduler.rehydrateNotifications(tasks);
```

### Implementation Details

1. Query database for tasks with future reminders
2. Filter out past reminders
3. Reschedule each notification
4. Track failures for monitoring

## Delivery Tracking

### Metrics

The system tracks delivery metrics to ensure ≥95% success rate:

```typescript
const stats = scheduler.getDeliveryStats();
// {
//   totalScheduled: 100,
//   totalDelivered: 97,
//   totalFailed: 3,
//   deliveryRate: 0.97, // 97%
//   averageDelayMs: 45000 // 45 seconds
// }
```

### Success Criteria

- **Delivery Rate**: ≥95% of notifications delivered
- **Timing Accuracy**: Within ±5 minutes of scheduled time
- **Test Matrix**: Pixel 6 (A14), Moto G-class, iPhone SE/13

### Monitoring

```typescript
// Handle notification delivery
Notifications.addNotificationReceivedListener((notification) => {
  const { taskId } = notification.request.content.data;
  scheduler.handleNotificationDelivered(notification.identifier);
});

// Verify delivery
const delivered = await scheduler.verifyDelivery(notificationId);
```

## Best Practices

### 1. Permission Handling

- Request permission in context
- Explain benefits clearly
- Handle denial gracefully
- Provide settings link

### 2. Alarm Selection

- Default to inexact alarms
- Use exact alarms sparingly
- Justify exact alarm usage
- Monitor battery impact

### 3. Doze Mode

- Test in Doze mode
- Provide fallback strategies
- Use WorkManager for critical tasks
- Monitor delivery rates

### 4. Channel Management

- Create channels on startup
- Version channels for updates
- Use appropriate importance levels
- Respect user preferences

### 5. Delivery Tracking

- Track all scheduled notifications
- Monitor delivery rates
- Alert on low delivery rates
- Clean up tracking data periodically

## Troubleshooting

### Notifications Not Appearing

1. Check permission status
2. Verify channel exists
3. Check Doze mode status
4. Verify trigger time is future
5. Check system notification settings

### Low Delivery Rate

1. Review Doze mode handling
2. Check exact alarm usage
3. Verify rehydration logic
4. Test on target devices
5. Monitor battery optimization settings

### Exact Alarms Not Working

1. Verify Android version ≥14
2. Check SCHEDULE_EXACT_ALARM permission
3. Verify trigger time within threshold
4. Check system alarm settings
5. Test permission request flow

## Testing Checklist

- [ ] Notifications work on Pixel 6 (Android 14)
- [ ] Notifications work on Moto G-class device
- [ ] Notifications work on iPhone SE/13
- [ ] Delivery rate ≥95% on test matrix
- [ ] Timing accuracy within ±5 minutes
- [ ] Works in Doze mode
- [ ] Works in Low Power mode (iOS)
- [ ] Rehydration works after app restart
- [ ] Rehydration works after device reboot
- [ ] Permission flow works correctly
- [ ] Exact alarm opt-in works
- [ ] Fallback to inexact works
- [ ] Channels created successfully
- [ ] Delivery tracking accurate

## References

- [Android Notifications Guide](https://developer.android.com/develop/ui/views/notifications)
- [Schedule Exact Alarms](https://developer.android.com/about/versions/14/changes/schedule-exact-alarms)
- [Doze and App Standby](https://developer.android.com/training/monitoring-device-state/doze-standby)
- [Notification Channels](https://developer.android.com/develop/ui/views/notifications/channels)
- [Runtime Permissions](https://developer.android.com/training/permissions/requesting)
