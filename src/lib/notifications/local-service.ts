import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { getAndroidChannelId } from '@/lib/notifications/android-channels';

type AndroidTrigger = Notifications.NotificationTriggerInput & {
  channelId?: string;
};

type TriggerWithDate = {
  type: 'date';
  value: number | string;
};

type TriggerWithCalendar = {
  type: 'calendar';
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
  second?: number;
};

type TriggerWithTimestamp = {
  timestamp: number;
};

const MAX_IOS_PENDING = 48;
export const IOS_PENDING_LIMIT = MAX_IOS_PENDING;

type ScheduleRequest = {
  idTag?: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  triggerDate: Date;
  androidChannelKey?: Parameters<typeof getAndroidChannelId>[0];
  threadId?: string;
};

export const LocalNotificationService = {
  async scheduleExactNotification(request: ScheduleRequest): Promise<string> {
    await enforceIosPendingLimit(request.triggerDate);
    let trigger: Notifications.NotificationTriggerInput;
    if (Platform.OS === 'ios') {
      const triggerDate = new Date(
        Math.max(request.triggerDate.getTime(), Date.now() + 1000)
      );
      trigger = {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      };
    } else {
      const triggerSeconds = Math.floor(
        (request.triggerDate.getTime() - Date.now()) / 1000
      );
      trigger = {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: triggerSeconds > 0 ? triggerSeconds : 1,
      };
    }
    if (Platform.OS === 'android' && request.androidChannelKey) {
      (trigger as AndroidTrigger).channelId = getAndroidChannelId(
        request.androidChannelKey
      );
    }
    const content: Notifications.NotificationContentInput = {
      title: request.title,
      body: request.body,
      data: request.data ?? {},
      sound:
        request.androidChannelKey === 'cultivation.reminders'
          ? 'default'
          : undefined,
      ...(Platform.OS === 'ios' && request.threadId
        ? { threadIdentifier: request.threadId }
        : {}),
    };
    const id = await Notifications.scheduleNotificationAsync({
      content,
      trigger,
    });
    return id;
  },

  async cancelScheduledNotification(identifier: string): Promise<void> {
    if (!identifier) return;
    await Notifications.cancelScheduledNotificationAsync(identifier);
  },

  async cancelNotifications(identifiers: string[]): Promise<void> {
    await Promise.all(
      identifiers.map((identifier) =>
        Notifications.cancelScheduledNotificationAsync(identifier)
      )
    );
  },

  async cancelAllScheduled(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  },

  async getPendingCount(): Promise<number> {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    return scheduled.length;
  },
};

async function enforceIosPendingLimit(incoming: Date): Promise<void> {
  if (Platform.OS !== 'ios') return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  if (scheduled.length < MAX_IOS_PENDING) return;
  const normalized = scheduled
    .map((entry) => ({
      id: entry.identifier,
      date: extractTriggerDate(entry.trigger),
    }))
    .filter((entry): entry is { id: string; date: Date } =>
      Boolean(entry.date)
    );
  normalized.push({ id: '__incoming', date: incoming });
  normalized.sort((a, b) => a.date.getTime() - b.date.getTime());
  const keep = normalized.slice(0, MAX_IOS_PENDING);
  const keepIds = new Set(keep.map((entry) => entry.id));
  const toCancel = normalized.filter(
    (entry) => !keepIds.has(entry.id) && entry.id !== '__incoming'
  );
  await Promise.all(
    toCancel.map((entry) =>
      Notifications.cancelScheduledNotificationAsync(entry.id)
    )
  );
}

function extractTriggerDate(trigger: unknown): Date | null {
  if (!trigger) return null;

  // Check for date trigger
  if (
    typeof trigger === 'object' &&
    (trigger as TriggerWithDate).type === 'date' &&
    (trigger as TriggerWithDate).value
  ) {
    return new Date((trigger as TriggerWithDate).value);
  }

  // Check for calendar trigger
  if (
    typeof trigger === 'object' &&
    (trigger as TriggerWithCalendar).type === 'calendar'
  ) {
    const {
      year,
      month,
      day,
      hour = 0,
      minute = 0,
      second = 0,
    } = trigger as TriggerWithCalendar;
    if (
      typeof year === 'number' &&
      typeof month === 'number' &&
      typeof day === 'number'
    ) {
      return new Date(year, month - 1, day, hour, minute, second);
    }
  }

  // Check for timestamp trigger
  if (
    typeof trigger === 'object' &&
    typeof (trigger as TriggerWithTimestamp).timestamp === 'number'
  ) {
    return new Date((trigger as TriggerWithTimestamp).timestamp);
  }

  return null;
}
