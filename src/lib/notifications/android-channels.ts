import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import i18n from '@/lib/i18n';
import { captureCategorizedErrorSync } from '@/lib/sentry-utils';

export type AndroidChannelKey =
  | 'community.interactions'
  | 'community.likes'
  | 'cultivation.reminders'
  | 'cultivation.alerts'
  | 'calibration.reminders'
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
    nameKey: 'notifications.channels.communityInteractions.name',
    descriptionKey: 'notifications.channels.communityInteractions.description',
    importance: getAndroidImportance('default'),
  },
  'community.likes': {
    id: `community.likes.${CHANNEL_VERSION}`,
    nameKey: 'notifications.channels.communityLikes.name',
    descriptionKey: 'notifications.channels.communityLikes.description',
    importance: getAndroidImportance('low'),
  },
  'cultivation.reminders': {
    id: `cultivation.reminders.${CHANNEL_VERSION}`,
    nameKey: 'notifications.channels.cultivationReminders.name',
    descriptionKey: 'notifications.channels.cultivationReminders.description',
    importance: getAndroidImportance('high'),
    sound: 'default',
  },
  'cultivation.alerts': {
    id: `cultivation.alerts.${CHANNEL_VERSION}`,
    nameKey: 'notifications.channels.cultivationAlerts.name',
    descriptionKey: 'notifications.channels.cultivationAlerts.description',
    importance: getAndroidImportance('high'),
    sound: 'default',
  },
  'calibration.reminders': {
    id: `calibration.reminders.${CHANNEL_VERSION}`,
    nameKey: 'notifications.channels.calibrationReminders.name',
    descriptionKey: 'notifications.channels.calibrationReminders.description',
    importance: getAndroidImportance('default'),
    sound: 'default',
  },
  'system.updates': {
    id: `system.updates.${CHANNEL_VERSION}`,
    nameKey: 'notifications.channels.systemUpdates.name',
    descriptionKey: 'notifications.channels.systemUpdates.description',
    importance: getAndroidImportance('default'),
  },
};

const CHANNEL_MIGRATIONS: Record<string, string> = {};

export function getAndroidChannelId(key: AndroidChannelKey): string {
  return ANDROID_CHANNEL_DEFINITIONS[key].id;
}

export async function registerAndroidChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const anyNotifications: any = Notifications as any;

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
  const anyNotifications: any = Notifications as any;
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
  const anyNotifications: any = Notifications as any;
  const visibility = anyNotifications.AndroidNotificationVisibility;
  if (visibility && typeof visibility.PUBLIC === 'number') {
    return visibility.PUBLIC;
  }
  return 1;
}
