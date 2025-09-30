import { client } from '@/api/common';
import type {
  NotificationPage,
  RemoteNotification,
} from '@/api/notifications/types';

export type FetchNotificationsParams = {
  cursor?: string;
  limit?: number;
  includeArchived?: boolean;
  signal?: AbortSignal;
};

export async function fetchNotifications(
  params: FetchNotificationsParams = {}
): Promise<NotificationPage> {
  const response = await client.get<NotificationPage>('notifications/inbox', {
    params: {
      cursor: params.cursor,
      limit: params.limit,
      includeArchived: params.includeArchived ? 'true' : undefined,
    },
    signal: params.signal,
  });
  const data = response.data ?? { items: [] };
  return {
    items: Array.isArray(data.items) ? data.items : [],
    nextCursor: data.nextCursor ?? null,
    unreadCount: data.unreadCount ?? undefined,
  };
}

export async function acknowledgeNotifications(
  ids: readonly string[],
  readAt: string
): Promise<void> {
  if (ids.length === 0) return;
  await client.post('notifications/acknowledge', {
    ids,
    readAt,
  });
}

export async function removeNotifications(
  ids: readonly string[]
): Promise<void> {
  if (ids.length === 0) return;
  await client.post('notifications/remove', { ids });
}

export async function syncUnreadCount(signal?: AbortSignal): Promise<number> {
  const response = await client.get<{ unread: number }>(
    'notifications/unread',
    {
      signal,
    }
  );
  const value = Number(response.data?.unread ?? 0);
  return Number.isFinite(value) ? value : 0;
}

export function coerceRemoteNotification(
  input: RemoteNotification
): RemoteNotification {
  return {
    ...input,
    data: input.data ?? null,
    deepLink: input.deepLink ?? null,
    readAt: input.readAt ?? null,
    expiresAt: input.expiresAt ?? null,
    archivedAt: input.archivedAt ?? null,
    deletedAt: input.deletedAt ?? null,
    messageId: input.messageId ?? null,
  };
}
