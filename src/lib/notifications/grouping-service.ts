import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { getAndroidChannelId } from '@/lib/notifications/android-channels';
import { captureCategorizedErrorSync } from '@/lib/sentry-utils';

type CommunityNotification = {
  notification: any; // Expo notification object
  type: 'community_interaction' | 'community_like';
  postId: string;
  threadId?: string;
};

// In-memory store for group counts (per app session)
const groupCounts: Map<string, number> = new Map();

export const NotificationGroupingService = {
  async handleCommunityNotification(
    notification: CommunityNotification
  ): Promise<void> {
    if (Platform.OS === 'android') {
      await handleAndroidGrouping(notification);
    } else {
      await handleiOSThreading(notification);
    }
  },

  resetGroupCount(groupKey: string): void {
    groupCounts.delete(groupKey);
  },

  getGroupCount(groupKey: string): number {
    return groupCounts.get(groupKey) || 0;
  },
};

async function handleAndroidGrouping(
  notification: CommunityNotification
): Promise<void> {
  try {
    const groupKey = `post_${notification.postId}`;
    const currentCount = (groupCounts.get(groupKey) || 0) + 1;
    groupCounts.set(groupKey, currentCount);

    const channelId =
      notification.type === 'community_interaction'
        ? getAndroidChannelId('community.interactions')
        : getAndroidChannelId('community.likes');

    // Create or update group summary
    const anyNotifications: any = Notifications as any;
    await anyNotifications.scheduleNotificationAsync({
      content: {
        title: 'Community Activity',
        body: `${currentCount} new ${currentCount > 1 ? 'interactions' : 'interaction'}`,
        data: { groupKey, type: 'summary' },
      },
      trigger: null, // Present immediately
      identifier: `summary_${groupKey}`,
      channelId,
      groupAlertBehavior: 'summary',
      groupKey,
      groupSummary: true,
    });

    // Present individual notification
    const content = notification.notification.request?.content || {};
    await anyNotifications.scheduleNotificationAsync({
      content: {
        title: content.title || '',
        body: content.body || '',
        data: content.data || {},
      },
      trigger: null, // Present immediately
      channelId,
      groupKey,
    });
  } catch (error) {
    captureCategorizedErrorSync(error, {
      operation: 'android_notification_grouping',
      postId: notification.postId,
    });
  }
}

async function handleiOSThreading(
  notification: CommunityNotification
): Promise<void> {
  try {
    // On iOS, the server should already set threadIdentifier in the APNs payload
    // We just present the notification; iOS handles visual grouping automatically
    const anyNotifications: any = Notifications as any;
    const content = notification.notification.request?.content || {};

    await anyNotifications.scheduleNotificationAsync({
      content: {
        title: content.title || '',
        body: content.body || '',
        data: content.data || {},
        threadIdentifier:
          notification.threadId || `post_${notification.postId}`,
      },
      trigger: null, // Present immediately
    });
  } catch (error) {
    captureCategorizedErrorSync(error, {
      operation: 'ios_notification_threading',
      postId: notification.postId,
    });
  }
}
