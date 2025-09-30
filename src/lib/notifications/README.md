# Notification Analytics & Monitoring

This directory contains the notification analytics and performance monitoring system for GrowBro. It tracks delivery metrics, engagement rates, and latency performance while accounting for platform-specific limitations.

## Overview

The notification analytics system provides:

- **Delivery tracking**: Monitor notification acceptance by Expo Push Service and device delivery where possible
- **Engagement metrics**: Track notification opens, dismissals (Android only), and time-to-open
- **Performance monitoring**: Measure end-to-end latency with p50/p95 percentiles
- **Alerting**: Detect delivery rates below 95% threshold and slow deliveries (>5s)

## Platform-Specific Limitations

### iOS Delivery Tracking

**Critical limitation**: iOS does not provide per-device delivery receipts via APNs.

- ✅ **Can track**: Server-side acceptance by Expo Push Service
- ✅ **Can track**: Client-side opens when user taps notification
- ❌ **Cannot track**: Whether notification was actually delivered to device
- ❌ **Cannot track**: Whether user dismissed notification

**Workaround**: Use Apple Push Console for aggregate delivery metrics (not exposed via API).

**Reference**: [Apple APNs Documentation](https://developer.apple.com/documentation/usernotifications)

### Android Delivery Tracking

**Available via FCM**: Android provides more delivery visibility through FCM.

- ✅ **Can track**: Server-side acceptance by Expo Push Service
- ✅ **Can track**: Client-side opens when user taps notification
- ✅ **Can track**: Notification dismissals via deleteIntent
- ⚠️ **Partial tracking**: Device delivery via FCM BigQuery (requires setup)

**Workaround**: Enable FCM BigQuery export for detailed delivery data (optional).

**Reference**: [FCM BigQuery Documentation](https://firebase.google.com/docs/cloud-messaging/understand-delivery)

### Expo Push Service Receipts

Expo provides push receipts that indicate whether the notification was accepted by FCM/APNs:

- ✅ **Can track**: Whether Expo successfully handed off notification to FCM/APNs
- ✅ **Can track**: Token errors (DeviceNotRegistered, InvalidCredentials)
- ❌ **Cannot track**: Final device delivery status
- ❌ **Cannot track**: User engagement (opens/dismissals) via Expo API

**Important**: Expo receipts report "sent" when FCM/APNs accepts the notification, not when it's delivered to the device.

**Reference**: [Expo Push Receipts](https://docs.expo.dev/push-notifications/sending-notifications/#push-receipts)

## Files

### Core Services

- **`notification-analytics.ts`**: Supabase-based analytics service for delivery stats, opt-in rates, and alerts
- **`notification-monitor.ts`**: Client-side performance monitoring with latency tracking
- **`use-notification-analytics.ts`**: React hooks for accessing analytics data in UI components

### Tests

- **`notification-analytics.test.ts`**: Tests for Supabase analytics queries and calculations
- **`notification-monitor.test.ts`**: Tests for latency record management
- **`notification-monitor-metrics.test.ts`**: Tests for metrics calculation and alerting
- **`notification-monitor-percentiles.test.ts`**: Tests for p50/p95 percentile calculations
- **`notification-monitor-user-actions.test.ts`**: Tests for user action tracking (opens, dismissals)
- **`use-notification-analytics.test.tsx`**: Tests for React hooks

## Usage

### Tracking Notification Delivery

```typescript
import {
  initLatencyRecord,
  recordSentToExpo,
  recordDeliveredToDevice,
  recordOpenedByUser,
} from '@/lib/notifications/notification-monitor';

// When creating notification request
initLatencyRecord(messageId, 'community.reply', Platform.OS);

// When Expo Push Service accepts notification
recordSentToExpo(messageId);

// When Expo receipt confirms delivery (limited meaning)
recordDeliveredToDevice(messageId);

// When user taps notification (most reliable engagement metric)
recordOpenedByUser(messageId);
```

### Fetching Analytics Dashboard

```typescript
import { useNotificationAnalytics } from '@/lib/notifications/use-notification-analytics';

function DashboardScreen() {
  const { data, isLoading } = useNotificationAnalytics();

  if (isLoading) return <Spinner />;

  return (
    <View>
      <Text>Delivery Rate: {data.deliveryRate}%</Text>
      <Text>Engagement Rate: {data.engagementRate}%</Text>
      <Text>Opt-in Rate: {data.optInRate}%</Text>
      {data.alerts.length > 0 && <AlertsBanner alerts={data.alerts} />}
    </View>
  );
}
```

### Monitoring Performance Metrics

```typescript
import { useNotificationMetrics } from '@/lib/notifications/use-notification-analytics';

function PerformanceMonitor() {
  const { data } = useNotificationMetrics();

  return (
    <View>
      <Text>
        P50 End-to-End Latency: {data.latency.endToEnd.p50}ms
      </Text>
      <Text>
        P95 End-to-End Latency: {data.latency.endToEnd.p95}ms
      </Text>
      {data.alerts.belowThreshold && (
        <Alert>Delivery rate below 95% threshold</Alert>
      )}
      {data.alerts.slowDeliveries > 0 && (
        <Alert>
          {data.alerts.slowDeliveries} community notifications exceeded 5s
          target
        </Alert>
      )}
    </View>
  );
}
```

## Database Views

Analytics data is stored in Supabase and exposed via views:

- **`notification_delivery_stats`**: Daily delivery and engagement statistics by type and platform
- **`notification_opt_in_rates`**: Current opt-in/opt-out rates by notification type
- **`notification_delivery_failures`**: Recent failures (last 24 hours) for debugging
- **`notification_engagement_tracking`**: Notification open events with time-to-open metrics

### SQL Functions

- **`get_delivery_rate(type, days)`**: Calculate delivery rate for specific notification type over N days
- **`check_delivery_rate_threshold(threshold)`**: Alert if any notification type falls below threshold (default 95%)

## Performance Targets

- **Community notifications**: <5 seconds end-to-end latency when online
- **Delivery rate**: ≥95% acceptance by Expo Push Service
- **Alert threshold**: Trigger alerts when delivery rate <95% for any notification type

## Tracking Semantics

### What "Delivery Rate" Means

Given platform limitations, our "delivery rate" calculation is:

```
Delivery Rate = (Notifications accepted by Expo) / (Notifications attempted)
```

**Not**:

```
True Device Delivery Rate = (Notifications delivered to device) / (Notifications attempted)
```

This semantic difference must be communicated in dashboards:

> **Delivery Rate** represents successful handoff to FCM/APNs via Expo Push Service.
> It does not guarantee final device delivery due to platform limitations.
> See [Platform-Specific Limitations](#platform-specific-limitations) for details.

### Engagement Metrics (Most Reliable)

Client-side tracking of notification opens is the most reliable metric:

```
Engagement Rate = (Notifications opened by user) / (Notifications delivered)
```

This works consistently on both iOS and Android because we control the client-side tracking.

## External Setup Requirements

### Optional: FCM BigQuery Export (Android)

For detailed Android delivery data:

1. Enable BigQuery in Firebase Console
2. Navigate to Project Settings → Cloud Messaging → BigQuery export
3. Enable "Message data" export
4. Query `firebase_messaging` dataset for delivery events

**Note**: This is optional and provides additional insights beyond Expo receipts.

### Optional: Apple Push Console (iOS)

For iOS aggregate delivery metrics:

1. Sign in to [Apple Push Console](https://icloud.com/pushconsole)
2. View aggregate delivery reports (not available via API)

**Note**: This is manual and not integrated into our analytics system.

## Alerting

The system automatically detects and reports:

- **Delivery rate alerts**: When any notification type falls below 95% in last 24 hours
- **Slow delivery alerts**: When community notifications exceed 5-second target
- **Token errors**: When device tokens become invalid (DeviceNotRegistered)

Alerts are exposed via:

- `useDeliveryRateAlerts()` hook for dashboard UI
- Supabase `check_delivery_rate_threshold()` function for server-side monitoring
- Notification monitor alerts in `getNotificationMetrics()`.alerts

## Testing

Run notification analytics tests:

```bash
pnpm test notification-analytics
pnpm test notification-monitor
pnpm test use-notification-analytics
```

## References

- [Expo Push Notifications](https://docs.expo.dev/push-notifications/overview/)
- [Apple APNs Documentation](https://developer.apple.com/documentation/usernotifications)
- [FCM Documentation](https://firebase.google.com/docs/cloud-messaging)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
