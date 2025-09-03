import * as Notifications from 'expo-notifications';

import { NoopAnalytics } from '@/lib/analytics';

// Compute delivery delay from scheduled UTC timestamp
export function computeDeliveryDelayMs(
  scheduledForUtc: string | Date | null | undefined,
  now: Date = new Date()
): number | null {
  if (!scheduledForUtc) return null;
  const scheduled =
    scheduledForUtc instanceof Date
      ? scheduledForUtc
      : new Date(scheduledForUtc);
  if (isNaN(scheduled.getTime())) return null;
  return Math.max(0, now.getTime() - scheduled.getTime());
}

async function resolveScheduledUtcForTask(
  taskId?: string
): Promise<string | null> {
  if (!taskId) return null;
  try {
    const { database } = await import('@/lib/watermelon');
    const queue = database.collections.get('notification_queue' as any) as any;
    const rows: any[] = await (queue as any).query().fetch();
    const candidates = rows
      .filter((r) => r.taskId === taskId && r.status === 'pending')
      .sort((a, b) =>
        String(a.scheduledForUtc).localeCompare(b.scheduledForUtc)
      );
    return candidates.length > 0
      ? String(candidates[candidates.length - 1].scheduledForUtc)
      : null;
  } catch {
    return null;
  }
}

export function registerNotificationMetrics(): () => void {
  const recvSub = (Notifications as any).addNotificationReceivedListener(
    async (event: any) => {
      try {
        const notificationId = event?.request?.identifier;
        const taskId = event?.request?.content?.data?.taskId as
          | string
          | undefined;
        await NoopAnalytics.track('notif_fired', { notificationId, taskId });
        const scheduledUtc = await resolveScheduledUtcForTask(taskId);
        const delay = computeDeliveryDelayMs(scheduledUtc);
        if (delay != null) {
          await NoopAnalytics.track('notif_delivery_delay_ms', { ms: delay });
        }
      } catch {}
    }
  );

  const respSub = (
    Notifications as any
  ).addNotificationResponseReceivedListener(async (response: any) => {
    try {
      const notificationId = response?.notification?.request?.identifier;
      const taskId = response?.notification?.request?.content?.data?.taskId as
        | string
        | undefined;
      const actionId = response?.actionIdentifier;
      await NoopAnalytics.track('notif_interacted', {
        notificationId,
        taskId,
        actionId,
      });
    } catch {}
  });

  return () => {
    try {
      recvSub?.remove?.();
    } catch {}
    try {
      respSub?.remove?.();
    } catch {}
  };
}
