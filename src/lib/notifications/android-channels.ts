import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import i18n from '@/lib/i18n';
import { captureCategorizedErrorSync } from '@/lib/sentry-utils';

// Android-specific types not in official expo-notifications types
type AndroidNotificationsExtended = typeof Notifications & {
  setNotificationChannelAsync?: (
    channelId: string,
    config: {
      name: string;
      description?: string;
      importance?: number;
      sound?: string;
      vibrationPattern?: number[];
      lockscreenVisibility?: number;
    }
  ) => Promise<void>;
  AndroidImportance?: Record<string, number>;
  AndroidNotificationVisibility?: {
    PUBLIC?: number;
  };
};

export type AndroidChannelKey =
  | 'community.interactions'
  | 'community.likes'
  | 'cultivation.reminders'
  | 'cultivation.alerts'
  | 'calibration.reminders'
  | 'inventory.alerts'
  | 'system.updates';

type AndroidChannelDefinition = {
  id: string;
  nameKey: string;
  descriptionKey: string;
  importance: number;
  sound?: string | null;
};

const CHANNEL_VERSION = 'v1';

const ANDROID_CHANNEL_DEFINITIONS: Record<
  AndroidChannelKey,
  AndroidChannelDefinition
> = {
  'community.interactions': {
    id: `community.interactions.${CHANNEL_VERSION}`,
    nameKey: 'notifications.channels.community_interactions.name',
    descriptionKey: 'notifications.channels.community_interactions.description',
    importance: getAndroidImportance('default'),
  },
  'community.likes': {
    id: `community.likes.${CHANNEL_VERSION}`,
    nameKey: 'notifications.channels.community_likes.name',
    descriptionKey: 'notifications.channels.community_likes.description',
    importance: getAndroidImportance('low'),
  },
  'cultivation.reminders': {
    id: `cultivation.reminders.${CHANNEL_VERSION}`,
    nameKey: 'notifications.channels.cultivation_reminders.name',
    descriptionKey: 'notifications.channels.cultivation_reminders.description',
    importance: getAndroidImportance('high'),
    sound: 'default',
  },
  'cultivation.alerts': {
    id: `cultivation.alerts.${CHANNEL_VERSION}`,
    nameKey: 'notifications.channels.cultivation_alerts.name',
    descriptionKey: 'notifications.channels.cultivation_alerts.description',
    importance: getAndroidImportance('high'),
    sound: 'default',
  },
  'calibration.reminders': {
    id: `calibration.reminders.${CHANNEL_VERSION}`,
    nameKey: 'notifications.channels.calibration_reminders.name',
    descriptionKey: 'notifications.channels.calibration_reminders.description',
    importance: getAndroidImportance('default'),
    sound: 'default',
  },
  'inventory.alerts': {
    id: `inventory.alerts.${CHANNEL_VERSION}`,
    nameKey: 'notifications.channels.inventory_alerts.name',
    descriptionKey: 'notifications.channels.inventory_alerts.description',
    importance: getAndroidImportance('high'),
    sound: 'default',
  },
  'system.updates': {
    id: `system.updates.${CHANNEL_VERSION}`,
    nameKey: 'notifications.channels.system_updates.name',
    descriptionKey: 'notifications.channels.system_updates.description',
    importance: getAndroidImportance('default'),
  },
};

const CHANNEL_MIGRATIONS: Record<string, string> = {};

export function getAndroidChannelId(key: AndroidChannelKey): string {
  return ANDROID_CHANNEL_DEFINITIONS[key].id;
}

export async function registerAndroidChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const anyNotifications = Notifications as AndroidNotificationsExtended;

  try {
    const results = await Promise.allSettled(
      Object.values(ANDROID_CHANNEL_DEFINITIONS).map(async (definition) => {
        const name = i18n.t(definition.nameKey);
        const description = i18n.t(definition.descriptionKey);
        await anyNotifications.setNotificationChannelAsync(definition.id, {
          name,
          description,
          importance: definition.importance,
          sound: definition.sound ?? undefined,
          vibrationPattern:
            definition.importance >= getAndroidImportance('default')
              ? [0, 250, 250, 250]
              : undefined,
          lockscreenVisibility:
            anyNotifications.AndroidNotificationVisibility?.PUBLIC ??
            getAndroidNotificationVisibilityPublic(),
        });
        return definition.id; // Return channel ID for success logging
      })
    );

    // Process results to log any failures
    const failures = results
      .map((result, index) => ({ result, index }))
      .filter(({ result }) => result.status === 'rejected')
      .map(({ result, index }) => {
        const channelId = Object.values(ANDROID_CHANNEL_DEFINITIONS)[index].id;
        return {
          channelId,
          error: (result as PromiseRejectedResult).reason,
        };
      });

    if (failures.length > 0) {
      failures.forEach(({ channelId, error }) => {
        captureCategorizedErrorSync(error, {
          channelId,
          operation: 'android_channel_registration',
          message: `Failed to register Android notification channel: ${channelId}`,
        });
      });
    }
  } catch (error) {
    // This should be extremely rare since we're using Promise.allSettled,
    // but log any unexpected global failures
    captureCategorizedErrorSync(error, {
      operation: 'android_channel_registration_batch',
      message:
        'Unexpected error during Android channel registration batch processing',
    });
  }
}

export function resolveMigratedChannelId(channelId: string): string {
  return CHANNEL_MIGRATIONS[channelId] ?? channelId;
}

function getAndroidImportance(
  level: 'min' | 'low' | 'default' | 'high' | 'max'
): number {
  const anyNotifications = Notifications as AndroidNotificationsExtended;
  const fallback: Record<typeof level, number> = {
    min: 1,
    low: 2,
    default: 3,
    high: 4,
    max: 5,
  };
  const runtime = anyNotifications.AndroidImportance;
  if (!runtime) return fallback[level];
  return runtime[level.toUpperCase()] ?? fallback[level];
}

function getAndroidNotificationVisibilityPublic(): number {
  const anyNotifications = Notifications as AndroidNotificationsExtended;
  const visibility = anyNotifications.AndroidNotificationVisibility;
  if (visibility && typeof visibility.PUBLIC === 'number') {
    return visibility.PUBLIC;
  }
  return 1;
}
