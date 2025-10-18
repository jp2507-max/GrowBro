import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { NotificationErrorType } from '@/lib/notification-errors';
import { getAndroidChannelId } from '@/lib/notifications/android-channels';
import { DeepLinkService } from '@/lib/notifications/deep-link-service';
import { NotificationGroupingService } from '@/lib/notifications/grouping-service';
import { notificationAnalytics } from '@/lib/notifications/notification-analytics';
import {
  recordDeliveredToDevice,
  recordOpenedByUser,
} from '@/lib/notifications/notification-monitor';
import { captureCategorizedErrorSync } from '@/lib/sentry-utils';

type NotificationType =
  | 'community.interaction'
  | 'community.reply'
  | 'community.like'
  | 'cultivation.reminder'
  | 'system.update';

type NotificationData = {
  type?: NotificationType;
  deepLink?: string;
  messageId?: string;
  threadId?: string;
  postId?: string;
  collapseKey?: string;
};

type ForegroundNotification = {
  notification: any; // Expo notification object
};

type NotificationResponse = {
  notification: any; // Expo notification object
  actionIdentifier: string;
};

let foregroundSubscription: any = null;
let responseSubscription: any = null;

// Export for testing
export const __testResetGlobals = () => {
  foregroundSubscription = null;
  responseSubscription = null;
};

export const PushReceiverService = {
  async setupNotificationHandlers(): Promise<void> {
    // Remove existing subscriptions if any
    if (foregroundSubscription) {
      foregroundSubscription.remove();
      foregroundSubscription = null;
    }
    if (responseSubscription) {
      responseSubscription.remove();
      responseSubscription = null;
    }

    // Set notification handler for foreground behavior
    const anyNotifications: any = Notifications as any;
    anyNotifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: false,
        shouldPlaySound: false,
        shouldSetBadge: true,
      }),
    });

    // Listen for notifications received while app is foregrounded
    foregroundSubscription = anyNotifications.addNotificationReceivedListener(
      handleForegroundNotification
    );

    // Listen for notification tap events
    responseSubscription =
      anyNotifications.addNotificationResponseReceivedListener(
        handleNotificationResponse
      );
  },

  removeNotificationHandlers(): void {
    if (foregroundSubscription) {
      foregroundSubscription.remove();
      foregroundSubscription = null;
    }
    if (responseSubscription) {
      responseSubscription.remove();
      responseSubscription = null;
    }
  },
};

async function handleForegroundNotification(
  event: ForegroundNotification
): Promise<void> {
  try {
    const data = extractNotificationData(event.notification);
    const notificationType = data.type || 'system.update';

    // Track delivery to device
    if (data.messageId) {
      recordDeliveredToDevice(data.messageId);
    }

    // Apply grouping logic for community notifications
    if (
      notificationType === 'community.interaction' ||
      notificationType === 'community.reply' ||
      notificationType === 'community.like'
    ) {
      await NotificationGroupingService.handleCommunityNotification({
        notification: event.notification,
        type: notificationType,
        postId: data.postId || '',
        threadId: data.threadId,
      });
    } else {
      // Present notification directly for non-community types
      const anyNotifications: any = Notifications as any;
      await anyNotifications.scheduleNotificationAsync({
        content: {
          title: event.notification.request.content.title || '',
          body: event.notification.request.content.body || '',
          data: event.notification.request.content.data,
          ...(Platform.OS === 'ios'
            ? {
                threadIdentifier: data.threadId,
                categoryIdentifier: getIOSCategoryId(notificationType),
              }
            : {}),
        },
        trigger: null, // Present immediately
        ...(Platform.OS === 'android'
          ? { channelId: mapToAndroidChannelId(notificationType) }
          : {}),
      });
    }
  } catch (error) {
    captureCategorizedErrorSync(error, {
      operation: 'handle_foreground_notification',
    });
  }
}

async function handleNotificationResponse(
  response: NotificationResponse
): Promise<void> {
  try {
    const data = extractNotificationData(response.notification);

    // Track notification opened
    if (data.messageId) {
      // Record in performance monitor
      recordOpenedByUser(data.messageId);

      // Track in analytics (updates notification_queue status)
      await notificationAnalytics.trackNotificationOpened(data.messageId);

      // Track open event in push service
      const { PushNotificationService } = await import('./push-service');
      await PushNotificationService.trackNotificationOpened(data.messageId);
    }

    // Handle deep link navigation
    if (data.deepLink) {
      await DeepLinkService.handle(data.deepLink);
    } else {
      // Fallback: navigate to notification center if no deep link
      const { router } = await import('expo-router');
      router.push('/notifications');
    }
  } catch (error) {
    captureCategorizedErrorSync(error, {
      operation: 'handle_notification_response',
      errorCode: NotificationErrorType.DEEP_LINK_INVALID,
    });
  }
}

function extractNotificationData(notification: any): NotificationData {
  const data = notification.request?.content?.data || {};
  return {
    type: data.type as NotificationType | undefined,
    deepLink: data.deepLink as string | undefined,
    messageId: data.messageId as string | undefined,
    threadId: data.threadId as string | undefined,
    postId: data.postId as string | undefined,
    collapseKey: data.collapseKey as string | undefined,
  };
}

function mapToAndroidChannelId(type: NotificationType): string {
  const channelKeyMap: Record<
    NotificationType,
    | 'community.interactions'
    | 'community.likes'
    | 'cultivation.reminders'
    | 'system.updates'
  > = {
    'community.interaction': 'community.interactions',
    'community.reply': 'community.interactions',
    'community.like': 'community.likes',
    'cultivation.reminder': 'cultivation.reminders',
    'system.update': 'system.updates',
  };
  return getAndroidChannelId(channelKeyMap[type]);
}

function getIOSCategoryId(type: NotificationType): string {
  const categoryMap: Record<NotificationType, string> = {
    'community.interaction': 'COMMUNITY_INTERACTIONS',
    'community.reply': 'COMMUNITY_INTERACTIONS',
    'community.like': 'COMMUNITY_LIKES',
    'cultivation.reminder': 'CULTIVATION_REMINDERS',
    'system.update': 'SYSTEM_UPDATES',
  };
  return categoryMap[type];
}
