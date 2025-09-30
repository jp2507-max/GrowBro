import {
  acknowledgeNotifications,
  coerceRemoteNotification,
  fetchNotifications,
  removeNotifications,
  syncUnreadCount,
} from '@/api/notifications/inbox';
import type { NotificationPage } from '@/api/notifications/types';
import {
  countUnread,
  deleteNotifications,
  markAsRead,
  type NotificationUpsertPayload,
  saveNotifications,
} from '@/lib/notifications/notification-storage';
import { getItem, removeItem, setItem } from '@/lib/storage';

const UNREAD_CACHE_KEY = 'notifications.unreadCount';
const PENDING_ACK_KEY = 'notifications.pendingAck.v1';
const PENDING_DELETE_KEY = 'notifications.pendingDelete.v1';

export type SyncOptions = {
  cursor?: string | null;
  limit?: number;
  includeArchived?: boolean;
  signal?: AbortSignal;
};

export async function syncNotificationInbox(
  options: SyncOptions = {}
): Promise<NotificationPage> {
  const page = await fetchNotifications({
    cursor: options.cursor ?? undefined,
    limit: options.limit,
    includeArchived: options.includeArchived,
    signal: options.signal,
  });

  const normalized: NotificationUpsertPayload[] = page.items.map((item) => {
    const remote = coerceRemoteNotification(item);
    return {
      id: remote.id,
      type: remote.type,
      title: remote.title,
      body: remote.body,
      data: remote.data ?? null,
      deepLink: remote.deepLink ?? null,
      createdAt: remote.createdAt,
      readAt: remote.readAt,
      expiresAt: remote.expiresAt,
      archivedAt: remote.archivedAt,
      deletedAt: remote.deletedAt,
      messageId: remote.messageId,
    } satisfies NotificationUpsertPayload;
  });

  await saveNotifications(normalized, {
    pruneMissing: !options.cursor,
    sourceIds: new Set(normalized.map((n) => n.id)),
  });

  if (typeof page.unreadCount === 'number') {
    cacheUnreadCount(page.unreadCount);
  }

  return page;
}

export async function markNotificationsReadRemote(
  ids: readonly string[],
  readAt: Date
): Promise<void> {
  if (!ids.length) return;
  const iso = readAt.toISOString();

  await markAsRead(ids, readAt);
  try {
    await acknowledgeNotifications(ids, iso);
    await flushPendingAcks();
  } catch {
    enqueuePendingAck(ids, iso);
  }
  const localUnread = await countUnread();
  cacheUnreadCount(localUnread);
}

export async function deleteNotificationsRemote(
  ids: readonly string[]
): Promise<void> {
  if (!ids.length) return;
  await deleteNotifications(ids);
  try {
    await removeNotifications(ids);
    await flushPendingDeletes();
  } catch {
    enqueuePendingDelete(ids);
  }
  const localUnread = await countUnread();
  cacheUnreadCount(localUnread);
}

export function cacheUnreadCount(count: number): void {
  setItem(UNREAD_CACHE_KEY, count);
}

export function loadCachedUnreadCount(): number {
  const value = getItem<number>(UNREAD_CACHE_KEY);
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return 0;
}

export async function reconcileUnreadCount(
  signal?: AbortSignal
): Promise<number> {
  try {
    const remoteUnread = await syncUnreadCount(signal);
    cacheUnreadCount(remoteUnread);
    return remoteUnread;
  } catch {
    return loadCachedUnreadCount();
  }
}

export async function flushPendingJobs(): Promise<void> {
  await Promise.all([flushPendingAcks(), flushPendingDeletes()]);
}

function enqueuePendingAck(ids: readonly string[], readAtIso: string): void {
  const queue = getItem<PendingAck[]>(PENDING_ACK_KEY) ?? [];
  queue.push({ ids: Array.from(ids), readAtIso });
  setItem(PENDING_ACK_KEY, queue);
}

function enqueuePendingDelete(ids: readonly string[]): void {
  const queue = getItem<PendingDelete[]>(PENDING_DELETE_KEY) ?? [];
  queue.push({ ids: Array.from(ids) });
  setItem(PENDING_DELETE_KEY, queue);
}

async function flushPendingAcks(): Promise<void> {
  const queue = getItem<PendingAck[]>(PENDING_ACK_KEY) ?? [];
  if (queue.length === 0) return;

  const remaining: PendingAck[] = [];
  for (const ack of queue) {
    try {
      await acknowledgeNotifications(ack.ids, ack.readAtIso);
    } catch {
      remaining.push(ack);
    }
  }

  if (remaining.length === 0) {
    removeItem(PENDING_ACK_KEY);
    return;
  }
  setItem(PENDING_ACK_KEY, remaining);
}

async function flushPendingDeletes(): Promise<void> {
  const queue = getItem<PendingDelete[]>(PENDING_DELETE_KEY) ?? [];
  if (queue.length === 0) return;

  const remaining: PendingDelete[] = [];
  for (const job of queue) {
    try {
      await removeNotifications(job.ids);
    } catch {
      remaining.push(job);
    }
  }

  if (remaining.length === 0) {
    removeItem(PENDING_DELETE_KEY);
    return;
  }
  setItem(PENDING_DELETE_KEY, remaining);
}

type PendingAck = {
  ids: string[];
  readAtIso: string;
};

type PendingDelete = {
  ids: string[];
};
