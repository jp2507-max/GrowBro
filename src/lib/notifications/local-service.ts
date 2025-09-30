import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { getAndroidChannelId } from '@/lib/notifications/android-channels';

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
    const trigger: any = {
      type: 'date',
      date: request.triggerDate,
    };
    if (Platform.OS === 'android' && request.androidChannelKey) {
      trigger.channelId = getAndroidChannelId(request.androidChannelKey);
    }
    const content: any = {
      title: request.title,
      body: request.body,
      data: request.data ?? {},
      threadId: request.threadId,
    };
    if (request.androidChannelKey === 'cultivation.reminders') {
      content.sound = 'default';
    }
    const anyNotifications: any = Notifications as any;
    const id = await anyNotifications.scheduleNotificationAsync({
      content,
      trigger,
    });
    return id;
  },

  async cancelScheduledNotification(identifier: string): Promise<void> {
    if (!identifier) return;
    const anyNotifications: any = Notifications as any;
    await anyNotifications.cancelScheduledNotificationAsync(identifier);
  },

  async cancelNotifications(identifiers: string[]): Promise<void> {
    const anyNotifications: any = Notifications as any;
    await Promise.all(
      identifiers.map((identifier) =>
        anyNotifications.cancelScheduledNotificationAsync(identifier)
      )
    );
  },

  async cancelAllScheduled(): Promise<void> {
    const anyNotifications: any = Notifications as any;
    await anyNotifications.cancelAllScheduledNotificationsAsync();
  },

  async getPendingCount(): Promise<number> {
    const anyNotifications: any = Notifications as any;
    const scheduled =
      await anyNotifications.getAllScheduledNotificationsAsync();
    return scheduled.length;
  },
};

async function enforceIosPendingLimit(incoming: Date): Promise<void> {
  if (Platform.OS !== 'ios') return;
  const anyNotifications: any = Notifications as any;
  const scheduled: any[] =
    await anyNotifications.getAllScheduledNotificationsAsync();
  if (scheduled.length < MAX_IOS_PENDING) return;
  const normalized = scheduled
    .map((entry: any) => ({
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
      anyNotifications.cancelScheduledNotificationAsync(entry.id)
    )
  );
}

function extractTriggerDate(trigger: unknown): Date | null {
  if (!trigger) return null;
  const anyTrigger: any = trigger;
  if (anyTrigger.type === 'date' && anyTrigger.value) {
    return new Date(anyTrigger.value);
  }
  if (anyTrigger.type === 'calendar') {
    const { year, month, day, hour = 0, minute = 0, second = 0 } = anyTrigger;
    if (
      typeof year === 'number' &&
      typeof month === 'number' &&
      typeof day === 'number'
    ) {
      return new Date(year, month - 1, day, hour, minute, second);
    }
  }
  if (typeof anyTrigger.timestamp === 'number') {
    return new Date(anyTrigger.timestamp);
  }
  return null;
}
