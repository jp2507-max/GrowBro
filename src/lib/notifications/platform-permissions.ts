/**
 * Platform-specific notification permission and channel management
 * Requirements: 4.3, 4.4, 4.10
 */

import * as Notifications from 'expo-notifications';
import { Alert, Linking, Platform } from 'react-native';

import { captureCategorizedErrorSync } from '@/lib/sentry-utils';

export type NotificationChannelId =
  | 'task_reminders'
  | 'harvest_alerts'
  | 'community_activity'
  | 'system_updates'
  | 'marketing';

export interface NotificationPermissionStatus {
  granted: boolean;
  canAskAgain: boolean;
  channelStatus?: Record<NotificationChannelId, boolean>; // Android only
}

/**
 * Gets the current notification permission status
 * Requirements: 4.3, 4.4
 */
export async function getNotificationPermissionStatus(): Promise<NotificationPermissionStatus> {
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();

  const granted = status === 'granted';

  // On Android, also check per-channel status
  if (Platform.OS === 'android' && granted) {
    const channelStatus = await getAndroidChannelStatus();
    return {
      granted,
      canAskAgain,
      channelStatus,
    };
  }

  return {
    granted,
    canAskAgain,
  };
}

/**
 * Requests notification permissions
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    captureCategorizedErrorSync(error, {
      source: 'notifications',
      feature: 'permissions',
      action: 'request',
    });
    return false;
  }
}

/**
 * Opens device notification settings
 * Requirements: 4.3, 4.4, 4.10
 */
export async function openNotificationSettings(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch (error) {
    captureCategorizedErrorSync(error, {
      source: 'notifications',
      feature: 'settings',
      action: 'open',
    });
    // Show user-friendly fallback message
    Alert.alert(
      'Unable to Open Settings',
      'Please manually open your device settings to enable notifications.',
      [{ text: 'OK' }]
    );
  }
}

/**
 * Gets Android notification channel status for each category
 * Requirements: 4.3, 4.10
 */
async function getAndroidChannelStatus(): Promise<
  Record<NotificationChannelId, boolean>
> {
  if (Platform.OS !== 'android') {
    return {
      task_reminders: true,
      harvest_alerts: true,
      community_activity: true,
      system_updates: true,
      marketing: true,
    };
  }

  try {
    // Check each notification channel
    const channels: NotificationChannelId[] = [
      'task_reminders',
      'harvest_alerts',
      'community_activity',
      'system_updates',
      'marketing',
    ];

    const statusMap: Record<NotificationChannelId, boolean> = {
      task_reminders: true,
      harvest_alerts: true,
      community_activity: true,
      system_updates: true,
      marketing: true,
    };

    // Use Notifications.getNotificationChannelAsync to check if channel is enabled
    for (const channelId of channels) {
      try {
        const channel =
          await Notifications.getNotificationChannelAsync(channelId);
        // Channel is disabled if it doesn't exist or importance is NONE
        statusMap[channelId] = channel
          ? channel.importance !== Notifications.AndroidImportance.NONE
          : false;
      } catch (error) {
        captureCategorizedErrorSync(error, {
          source: 'notifications',
          feature: 'channels',
          action: 'check',
          channelId,
        });
        statusMap[channelId] = false;
      }
    }

    return statusMap;
  } catch (error) {
    captureCategorizedErrorSync(error, {
      source: 'notifications',
      feature: 'channels',
      action: 'get_status',
    });
    throw error;
  }
}

/**
 * Creates Android notification channels
 * Requirements: 4.10
 */
export async function createAndroidNotificationChannels(): Promise<{
  succeeded: string[];
  failed: string[];
}> {
  if (Platform.OS !== 'android') {
    return { succeeded: [], failed: [] };
  }

  const succeeded: string[] = [];
  const failed: string[] = [];

  const channels: {
    id: NotificationChannelId;
    name: string;
    description: string;
    importance: Notifications.AndroidImportance;
    sound?: string;
    vibrationPattern?: number[];
  }[] = [
    {
      id: 'task_reminders',
      name: 'Task Reminders',
      description: 'Notifications for upcoming cultivation tasks',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
    },
    {
      id: 'harvest_alerts',
      name: 'Harvest Alerts',
      description: 'Important notifications about harvest timing and status',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
    },
    {
      id: 'community_activity',
      name: 'Community Activity',
      description: 'Notifications for community interactions and posts',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
    },
    {
      id: 'system_updates',
      name: 'System Updates',
      description: 'Important app updates and announcements',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
    },
    {
      id: 'marketing',
      name: 'Marketing & Tips',
      description: 'Optional growing tips and feature announcements',
      importance: Notifications.AndroidImportance.LOW,
    },
  ];

  for (const channelConfig of channels) {
    try {
      await Notifications.setNotificationChannelAsync(channelConfig.id, {
        name: channelConfig.name,
        description: channelConfig.description,
        importance: channelConfig.importance,
        sound: channelConfig.sound,
        vibrationPattern: channelConfig.vibrationPattern,
        enableVibrate: !!channelConfig.vibrationPattern,
      });
      succeeded.push(channelConfig.id);
    } catch (error) {
      failed.push(channelConfig.id);
      captureCategorizedErrorSync(error, {
        source: 'notifications',
        feature: 'channels',
        action: 'create',
        channelId: channelConfig.id,
      });
    }
  }

  return { succeeded, failed };
}
