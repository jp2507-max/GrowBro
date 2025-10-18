import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { getAndroidChannelId } from '@/lib/notifications/android-channels';
import { captureCategorizedErrorSync } from '@/lib/sentry-utils';

type CommunityNotification = {
  notification: any; // Expo notification object
  type:
    | 'community_interaction'
    | 'community.interaction'
    | 'community.reply'
    | 'community_like'
    | 'community.like';
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
  communityNotification: CommunityNotification
): Promise<void> {
  try {
    const groupKey = `post_${communityNotification.postId}`;
    const currentCount = (groupCounts.get(groupKey) || 0) + 1;
    groupCounts.set(groupKey, currentCount);

    const channelId =
      communityNotification.type === 'community_interaction'
        ? getAndroidChannelId('community.interactions')
        : getAndroidChannelId('community.likes');

    // Create or update group summary
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Community Activity',
        body: `${currentCount} new ${currentCount > 1 ? 'interactions' : 'interaction'}`,
        data: { groupKey, type: 'summary', channelId },
      },
      trigger: null as any, // Present immediately (TypeScript types are incorrect, null is valid per Expo docs)
    });

    // Present individual notification
    const content = communityNotification.notification.request?.content || {};
    await Notifications.scheduleNotificationAsync({
      content: {
        title: content.title || '',
        body: content.body || '',
        data: { ...content.data, groupKey, channelId },
      },
      trigger: null as any, // Present immediately (TypeScript types are incorrect, null is valid per Expo docs)
    });
  } catch (error) {
    captureCategorizedErrorSync(error, {
      operation: 'android_notification_grouping',
      postId: communityNotification.postId,
    });
  }
}

async function handleiOSThreading(
  communityNotification: CommunityNotification
): Promise<void> {
  try {
    // On iOS, the server should already set threadIdentifier in the APNs payload
    // We just present the notification; iOS handles visual grouping automatically
    const content = communityNotification.notification.request?.content || {};

    await Notifications.scheduleNotificationAsync({
      content: {
        title: content.title || '',
        body: content.body || '',
        data: {
          ...content.data,
          threadIdentifier:
            communityNotification.threadId ||
            `post_${communityNotification.postId}`,
        },
      },
      trigger: null as any, // Present immediately (TypeScript types are incorrect, null is valid per Expo docs)
    });
  } catch (error) {
    captureCategorizedErrorSync(error, {
      operation: 'ios_notification_threading',
      postId: communityNotification.postId,
    });
  }
}
