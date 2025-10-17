# Play Store Exact Alarm Permission Justification

> Compliance disclaimer
>
> - This app is designed exclusively for personal plant care only.
> - It does not provide marketplace or commerce/transactional or logistics features.
> - Content complies with local laws and Play policies and may vary by region.

## Policy Compliance Reference

[Google Play Exact Alarms Policy](https://support.google.com/googleplay/android-developer/answer/13161072)

## Permission Declaration

```xml
<!-- Required for timely low-stock inventory alerts -->
<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />
```

## Use Case: Cultivation Supply Management

### Business Context

GrowBro is a cultivation management app for home cannabis growers. Users track essential growing supplies (nutrients, pH adjusters, substrates) in their inventory. Running out of critical supplies at the wrong growth stage can severely impact or destroy an entire harvest.

### Why Exact Alarms Are Required

1. **Time-Sensitive Nature**
   - Cannabis plants have specific feeding schedules based on growth stages
   - Missing a feeding window can cause nutrient deficiencies or toxicities
   - pH imbalances must be corrected within hours, not days
   - Users need **immediate** alerts when supplies fall below safe thresholds

2. **User-Initiated Functionality**
   - Users explicitly set minimum stock levels for each item
   - Users opt-in to low-stock notifications via app settings
   - Alert thresholds are customizable per item
   - Users can disable notifications at any time

3. **Cannot Be Achieved with WorkManager**
   - WorkManager's ±15-minute flexibility is insufficient for time-critical supply alerts
   - A 15-minute delay could mean missing a feeding window entirely
   - pH correction products need immediate alerts (pH changes rapidly)
   - Forecasting shows exact stockout timing - users expect timely warnings

### Fallback Behavior

The app gracefully handles denied permission:

1. **Inexact Alarms as Fallback**
   - Schedules notifications without SCHEDULE_EXACT_ALARM
   - Notification body includes "(may be delayed)" text
   - User receives warning banner about potential delays
   - All functionality remains available

2. **User Communication**
   - Permission rationale shown before requesting (Play Store requirement)
   - Clear explanation of timing trade-offs
   - Link to Settings for manual permission grant
   - In-app banner if permission denied

3. **No Feature Degradation**
   - Inventory tracking continues normally
   - Forecasting remains accurate
   - Manual item checking always available
   - Data sync unaffected

## User Experience Flow

### Permission Request Flow

1. User creates inventory item with stock below minimum
2. App shows bottom sheet with clear rationale:
   - **Title:** "Enable Timely Notifications"
   - **Why:** "Exact alarms ensure you're notified the moment supplies run low"
   - **If Denied:** "Notifications may be delayed by up to 15 minutes"
3. User chooses "Enable Notifications" or "Not Now"
4. If enabled, system permission dialog appears
5. Permission outcome tracked (respecting analytics consent)

### Notification Content Example

```text
Title: Low stock: General Hydroponics pH Down
Body: 50 ml remaining (below 200 ml) ~3 days left
Action: Tap to view item details and reorder
```

## Screenshots

### 1. Permission Rationale Sheet

![Permission Sheet](./screenshots/exact-alarm-permission-sheet.png)

- Shows before Android system dialog
- Clear explanation of timing benefit
- Opt-out option visible

### 2. Fallback Banner (Permission Denied)

![Fallback Banner](./screenshots/exact-alarm-fallback-banner.png)

- Warning icon prominent
- "Open Settings" link functional
- Non-intrusive design

### 3. Low-Stock Notification

![Notification](./screenshots/low-stock-notification.png)

- Clear item name and quantities
- Days-to-zero forecast shown
- Deep-links to item detail

## Technical Implementation

### Scheduling Logic

```typescript
// Check permission status
const canUseExactAlarms = await ExactAlarmCoordinator.canScheduleExactAlarms();

if (canUseExactAlarms) {
  // Schedule exact alarm (within 1 second)
  await LocalNotificationService.scheduleExactNotification({
    triggerDate: new Date(Date.now() + 1000),
    // ... notification config
  });
} else {
  // Fallback to inexact (±15 minute window)
  await LocalNotificationService.scheduleNotification({
    triggerDate: new Date(Date.now() + 1000),
    allowWhileIdle: true,
    // ... notification config with "(may be delayed)" appended
  });
}
```

### Permission Check Flow

```typescript
// User-visible rationale (Play Store requirement)
Alert.alert(
  'Enable Timely Alerts',
  'GrowBro needs exact alarm permission to send timely low-stock alerts...',
  [
    { text: 'Use Flexible Notifications', onPress: () => resolve(false) },
    {
      text: 'Enable',
      onPress: async () => {
        const granted = await launchExactAlarmPermissionScreen();
        resolve(granted);
      },
    },
  ]
);

// Launch Android settings
await Linking.sendIntent('android.settings.REQUEST_SCHEDULE_EXACT_ALARM', [
  {
    key: 'android.provider.extra.APP_PACKAGE',
    value: packageName,
  },
]);
```

## Metrics & Monitoring

### Tracked Metrics (User Consent Required)

- Permission grant/deny rates
- Notification delivery timing (exact vs inexact)
- Notification interaction rates
- Forecast accuracy for timing predictions

### Privacy Compliance

- All telemetry respects user analytics consent
- No PII in telemetry events
- Item IDs anonymized in logs
- User can opt-out anytime via app settings

## Alternative Approaches Considered

### Why WorkManager Insufficient

- **±15 minute flexibility** unacceptable for time-critical alerts
- Cannabis feeding schedules often have 1-2 hour windows
- pH correction requires immediate action
- User expectations set by forecast precision (e.g., "3 days left")

### Why Polling Insufficient

- Battery drain unacceptable for background polling
- Doze mode would delay checks significantly
- No way to guarantee timely delivery
- Violates Android battery optimization best practices

### Why Push Notifications Insufficient

- Requires internet connection (cultivation often remote/offline)
- Server dependency adds complexity and costs
- Forecasting is local-only (offline-first architecture)
- Privacy concern: server knows user inventory levels

## Policy Compliance Checklist

- [x] User-facing functionality with clear benefit
- [x] Permission rationale shown before request
- [x] Graceful fallback when permission denied
- [x] No feature blocking or degradation
- [x] Cannot reasonably use WorkManager (time sensitivity)
- [x] User-initiated action triggers permission need
- [x] Privacy-respecting telemetry with consent
- [x] Clear documentation of use case
- [x] Screenshots demonstrating UX flow

## Reviewer Notes

**Key Points for App Review:**

1. This is a **time-critical cultivation supply alert system**, not marketing/engagement
2. Users **explicitly set minimum stock thresholds** - they want immediate alerts
3. **Graceful fallback** to inexact alarms maintains full functionality
4. Permission request only appears when **user creates low-stock item**
5. Clear rationale shown **before** system permission dialog (policy compliance)

**Testing Instructions:**

1. Create inventory item: "Test Nutrient", Current: 50ml, Min: 200ml
2. Permission sheet appears explaining timing benefits
3. Grant permission → notification appears within seconds
4. Deny permission → fallback banner appears, notification delayed ~15min
5. All inventory features remain functional regardless of permission

## Contact Information

For Play Store reviewer questions: [developer email]
App version: [from package.json]
Submission date: [date]
