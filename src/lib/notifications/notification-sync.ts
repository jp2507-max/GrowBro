import { Q } from '@nozbe/watermelondb';

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
import { database } from '@/lib/watermelon';
import type { NotificationModel } from '@/lib/watermelon-models/notification';

const UNREAD_CACHE_KEY = 'notifications.unreadCount';
const PENDING_ACK_KEY = 'notifications.pendingAck.v1';
const PENDING_DELETE_KEY = 'notifications.pendingDelete.v1';
const COLLECTION_NAME = 'notifications';

// Mutex for synchronizing ack queue operations
let ackQueueMutex: Promise<unknown> | null = null;

// Mutex for synchronizing delete queue operations
let deleteQueueMutex: Promise<unknown> | null = null;

async function withAckQueueMutex<T>(operation: () => Promise<T>): Promise<T> {
  // Wait for any ongoing operation to complete
  if (ackQueueMutex) {
    await ackQueueMutex;
  }

  // Execute the operation while holding the mutex
  ackQueueMutex = operation();

  try {
    return (await ackQueueMutex) as T;
  } finally {
    ackQueueMutex = null;
  }
}

async function withDeleteQueueMutex<T>(
  operation: () => Promise<T>
): Promise<T> {
  // Wait for any ongoing operation to complete
  if (deleteQueueMutex) {
    await deleteQueueMutex;
  }

  // Execute the operation while holding the mutex
  deleteQueueMutex = operation();

  try {
    return (await deleteQueueMutex) as T;
  } finally {
    deleteQueueMutex = null;
  }
}

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
  } catch {
    await enqueuePendingAck(ids, iso);
  }

  // Always attempt to flush pending acks to ensure sync before returning
  // This guarantees that any queued work is processed before updating unread count
  await flushPendingAcks();

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
  } catch (err) {
    // Same mitigation as acks: after failed flush, re-check which ids still need enqueuing
    const remainingIds = await getPendingDeleteIds(ids);
    if (remainingIds.length > 0) {
      await enqueuePendingDelete(remainingIds);
    }
    throw err; // Re-throw the original error
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

async function enqueuePendingAck(
  ids: readonly string[],
  readAtIso: string
): Promise<void> {
  await withAckQueueMutex(async () => {
    const queue = getItem<PendingAck[]>(PENDING_ACK_KEY) ?? [];
    queue.push({ ids: Array.from(ids), readAtIso });
    setItem(PENDING_ACK_KEY, queue);
  });
}

async function enqueuePendingDelete(ids: readonly string[]): Promise<void> {
  await withDeleteQueueMutex(async () => {
    const queue = getItem<PendingDelete[]>(PENDING_DELETE_KEY) ?? [];
    queue.push({ ids: Array.from(ids) });
    setItem(PENDING_DELETE_KEY, queue);
  });
}

async function getPendingDeleteIds(ids: readonly string[]): Promise<string[]> {
  if (!ids.length) return [];

  const collection = database.collections.get(
    COLLECTION_NAME as keyof typeof database.collections
  ) as any;

  const records = (await collection
    .query(Q.where('id', Q.oneOf([...ids])))
    .fetch()) as NotificationModel[];

  return records
    .filter((record) => record.deletedAt != null)
    .map((record) => record.id);
}

async function flushPendingAcks(): Promise<void> {
  await withAckQueueMutex(async () => {
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
  });
}

async function flushPendingDeletes(): Promise<void> {
  await withDeleteQueueMutex(async () => {
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
  });
}

type PendingAck = {
  ids: string[];
  readAtIso: string;
};

type PendingDelete = {
  ids: string[];
};
