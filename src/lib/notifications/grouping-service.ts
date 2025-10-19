/// <reference path="../../types/expo-notifications.d.ts" />

import type { Notification } from 'expo-notifications';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { translate } from '@/lib/i18n';
import { getAndroidChannelId } from '@/lib/notifications/android-channels';
import { captureCategorizedErrorSync } from '@/lib/sentry-utils';

export type CommunityNotification = {
  notification: Notification; // Expo notification object
  type: 'community.interaction' | 'community.reply' | 'community.like';
  postId?: string;
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
    const groupKey =
      communityNotification.threadId ??
      (communityNotification.postId
        ? `post_${communityNotification.postId}`
        : null);
    if (!groupKey) {
      // Present as a single notification without grouping
      const content = communityNotification.notification.request?.content || {};
      const t = communityNotification.type;
      const isLike = t === 'community.like';
      const channelId = getAndroidChannelId(
        isLike ? 'community.likes' : 'community.interactions'
      );
      await Notifications.scheduleNotificationAsync({
        content: {
          title: content.title || '',
          body: content.body || '',
          data: content.data,
        },
        trigger: { channelId } as any, // Present immediately (TypeScript types are incorrect, null is valid per Expo docs)
      });
      return;
    }

    const currentCount = (groupCounts.get(groupKey) || 0) + 1;
    groupCounts.set(groupKey, currentCount);

    const t = communityNotification.type;
    const isLike = t === 'community.like';
    const channelId = getAndroidChannelId(
      isLike ? 'community.likes' : 'community.interactions'
    );

    // Create or update group summary
    await Notifications.scheduleNotificationAsync({
      content: {
        title: translate('community.community_activity'),
        body: `${currentCount} new ${currentCount > 1 ? 'interactions' : 'interaction'}`,
        data: { groupKey, type: 'summary' },
      },
      trigger: { channelId } as any, // Present immediately (TypeScript types are incorrect, null is valid per Expo docs)
    });

    // Present individual notification
    const content = communityNotification.notification.request?.content || {};
    await Notifications.scheduleNotificationAsync({
      content: {
        title: content.title || '',
        body: content.body || '',
        data: { ...content.data, groupKey },
      },
      trigger: { channelId } as any, // Present immediately (TypeScript types are incorrect, null is valid per Expo docs)
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

    // Compute threadId value: prefer threadId, else build from postId if present
    const threadId =
      communityNotification.threadId ||
      (communityNotification.postId
        ? `post_${communityNotification.postId}`
        : undefined);

    const notificationContent: Notifications.NotificationContentInput & {
      threadIdentifier?: string;
    } = {
      title: content.title || '',
      body: content.body || '',
      data: {
        ...content.data,
      },
      ...(threadId && { threadIdentifier: threadId }),
    };

    await Notifications.scheduleNotificationAsync({
      content: notificationContent,
      trigger: null as any, // Present immediately (TypeScript types are incorrect, null is valid per Expo docs)
    });
  } catch (error) {
    captureCategorizedErrorSync(error, {
      operation: 'ios_notification_threading',
      postId: communityNotification.postId,
    });
  }
}
