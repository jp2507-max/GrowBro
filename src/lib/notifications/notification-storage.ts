import type { Collection, Model } from '@nozbe/watermelondb';
import { Q } from '@nozbe/watermelondb';

import { getItem, setItem } from '@/lib/storage';
import { database } from '@/lib/watermelon';
import type { NotificationModel } from '@/lib/watermelon-models/notification';

const COLLECTION_NAME = 'notifications';
const DEFAULT_PAGE_SIZE = 25;
const CURSOR_STORAGE_KEY = 'notifications.lastCursor';

export type NotificationSnapshot = {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  deepLink: string | null;
  createdAt: Date;
  readAt: Date | null;
  expiresAt: Date | null;
  archivedAt: Date | null;
  deletedAt: Date | null;
  messageId: string | null;
};

export type ListNotificationsParams = {
  limit?: number;
  cursor?: number | null;
  includeArchived?: boolean;
  includeDeleted?: boolean;
};

export type ListNotificationsResult = {
  items: NotificationSnapshot[];
  nextCursor: number | null;
};

export type NotificationUpsertPayload = {
  id: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown> | string | null;
  deepLink?: string | null;
  createdAt: string | Date;
  readAt?: string | Date | null;
  expiresAt?: string | Date | null;
  archivedAt?: string | Date | null;
  deletedAt?: string | Date | null;
  messageId?: string | null;
};

export type SaveNotificationsOptions = {
  pruneMissing?: boolean;
  sourceIds?: Set<string>;
};

export async function listNotifications(
  params: ListNotificationsParams = {}
): Promise<ListNotificationsResult> {
  const {
    limit = DEFAULT_PAGE_SIZE,
    cursor = null,
    includeArchived = false,
    includeDeleted = false,
  } = params;

  const collection = database.collections.get(
    COLLECTION_NAME as keyof typeof database.collections
  ) as Collection<NotificationModel>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clauses: any[] = [];

  if (!includeArchived) {
    clauses.push(Q.where('archived_at', null));
  }
  if (!includeDeleted) {
    clauses.push(Q.where('deleted_at', null));
  }
  if (cursor != null) {
    clauses.push(Q.where('created_at', Q.lt(cursor)));
  }

  clauses.push(Q.sortBy('created_at', 'desc'));
  clauses.push(Q.take(limit));

  const records = (await collection
    .query(...clauses)
    .fetch()) as NotificationModel[];
  const items = records.map(toSnapshot);
  const nextCursor =
    records.length === limit
      ? records[records.length - 1].createdAt.getTime()
      : null;

  if (nextCursor != null) {
    setItem(CURSOR_STORAGE_KEY, nextCursor);
  }

  return { items, nextCursor };
}

export async function loadLastCursor(): Promise<number | null> {
  const stored = getItem<number>(CURSOR_STORAGE_KEY);
  return typeof stored === 'number' ? stored : null;
}

export async function countUnread(): Promise<number> {
  const collection = database.collections.get(
    COLLECTION_NAME as keyof typeof database.collections
  ) as Collection<NotificationModel>;
  return collection
    .query(
      Q.where('deleted_at', null),
      Q.where('archived_at', null),
      Q.where('read_at', null)
    )
    .fetchCount();
}

export async function markAsRead(
  ids: readonly string[],
  readAt: Date = new Date()
): Promise<void> {
  if (!ids.length) return;
  const collection = database.collections.get(
    COLLECTION_NAME as keyof typeof database.collections
  ) as Collection<NotificationModel>;

  const failedIds: string[] = [];

  await database.write(async () => {
    for (const id of ids) {
      try {
        const record = await collection.find(id);
        await record.update((model: NotificationModel) => {
          model.readAt = readAt;
        });
      } catch {
        failedIds.push(id);
      }
    }
  });

  if (failedIds.length > 0) {
    console.error(
      `Failed to mark ${failedIds.length} notification(s) as read:`,
      { failedIds, totalAttempted: ids.length }
    );
  }
}

export async function markAsUnread(ids: readonly string[]): Promise<void> {
  if (!ids.length) return;
  const collection = database.collections.get(
    COLLECTION_NAME as keyof typeof database.collections
  ) as Collection<NotificationModel>;

  await database.write(async () => {
    for (const id of ids) {
      try {
        const record = await collection.find(id);
        await record.update((model: NotificationModel) => {
          model.readAt = undefined;
        });
      } catch {}
    }
  });
}

export async function archiveNotifications(
  ids: readonly string[],
  archivedAt: Date = new Date()
): Promise<void> {
  if (!ids.length) return;
  const collection = database.collections.get(
    COLLECTION_NAME as keyof typeof database.collections
  ) as Collection<NotificationModel>;

  await database.write(async () => {
    for (const id of ids) {
      try {
        const record = await collection.find(id);
        await record.update((model: NotificationModel) => {
          model.archivedAt = archivedAt;
        });
      } catch {}
    }
  });
}

export async function unarchiveNotifications(
  ids: readonly string[]
): Promise<void> {
  if (!ids.length) return;
  const collection = database.collections.get(
    COLLECTION_NAME as keyof typeof database.collections
  ) as Collection<NotificationModel>;

  await database.write(async () => {
    for (const id of ids) {
      try {
        const record = await collection.find(id);
        await record.update((model: NotificationModel) => {
          model.archivedAt = undefined;
        });
      } catch {}
    }
  });
}

export async function archiveOlderThan(
  options: { days?: number; now?: Date } = {}
): Promise<number> {
  const { days = 30, now = new Date() } = options;
  const threshold = now.getTime() - days * 24 * 60 * 60 * 1000;
  const collection = database.collections.get(
    COLLECTION_NAME as keyof typeof database.collections
  ) as Collection<NotificationModel>;

  const records = (await collection
    .query(
      Q.where('deleted_at', null),
      Q.where('archived_at', null),
      Q.where('created_at', Q.lt(threshold))
    )
    .fetch()) as NotificationModel[];

  if (records.length === 0) return 0;

  await database.write(async () => {
    for (const record of records) {
      await record.update((model: NotificationModel) => {
        model.archivedAt = now;
      });
    }
  });
  return records.length;
}

export async function deleteNotifications(
  ids: readonly string[]
): Promise<void> {
  if (!ids.length) return;
  const collection = database.collections.get(
    COLLECTION_NAME as keyof typeof database.collections
  ) as Collection<NotificationModel>;

  await database.write(async () => {
    for (const id of ids) {
      try {
        const record = await collection.find(id);
        await record.update((model: NotificationModel) => {
          model.deletedAt = new Date();
        });
      } catch {}
    }
  });
}

export async function purgeAllNotifications(): Promise<void> {
  const collection = database.collections.get(
    COLLECTION_NAME as keyof typeof database.collections
  ) as Collection<NotificationModel>;
  const records = (await collection.query().fetch()) as NotificationModel[];
  if (records.length === 0) return;

  await database.write(async () => {
    for (const record of records) {
      await (record as unknown as Model).destroyPermanently();
    }
  });
}

export async function saveNotifications(
  payloads: readonly NotificationUpsertPayload[],
  options: SaveNotificationsOptions = {}
): Promise<void> {
  if (!payloads.length) return;
  const collection = database.collections.get(
    COLLECTION_NAME as keyof typeof database.collections
  ) as Collection<NotificationModel>;
  const sourceIds = options.sourceIds ?? new Set(payloads.map((n) => n.id));

  await database.write(async () => {
    for (const item of payloads) {
      const existing = await safeFind(collection, item.id);
      if (existing) {
        await existing.update((model: NotificationModel) => {
          assignNotificationFields(model, item);
        });
        continue;
      }

      await collection.create((model: NotificationModel & Model) => {
        model._raw.id = item.id;
        assignNotificationFields(model, item);
      });
    }

    if (options.pruneMissing) {
      const keepIds = new Set(sourceIds);
      const payloadIds = Array.from(keepIds);
      const survivors = (await collection
        .query(Q.where('deleted_at', null), Q.where('id', Q.notIn(payloadIds)))
        .fetch()) as NotificationModel[];
      const deleteDate = new Date();
      await Promise.all(
        survivors.map((record) =>
          record.update((model: NotificationModel) => {
            model.deletedAt = deleteDate;
          })
        )
      );
    }
  });
}

function assignNotificationFields(
  model: NotificationModel,
  payload: NotificationUpsertPayload
): void {
  model.type = payload.type;
  model.title = payload.title;
  model.body = payload.body;
  model.data = stringifyPayloadData(payload.data);
  model.deepLink = payload.deepLink ?? undefined;
  model.createdAt = ensureDate(payload.createdAt);
  model.readAt =
    payload.readAt != null ? ensureDate(payload.readAt) : undefined;
  model.expiresAt =
    payload.expiresAt != null ? ensureDate(payload.expiresAt) : undefined;
  model.archivedAt =
    payload.archivedAt != null ? ensureDate(payload.archivedAt) : undefined;
  model.deletedAt =
    payload.deletedAt != null ? ensureDate(payload.deletedAt) : undefined;
  model.messageId = payload.messageId ?? undefined;
}

async function safeFind(
  collection: Collection<NotificationModel>,
  id: string
): Promise<NotificationModel | null> {
  try {
    return await collection.find(id);
  } catch {
    return null;
  }
}

export function stringifyPayloadData(
  value: NotificationUpsertPayload['data']
): string {
  if (value == null) return '<<NULL>>';
  try {
    return JSON.stringify(value);
  } catch {
    return '<<SERIALIZE_ERROR>>';
  }
}

function ensureDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    throw new TypeError(
      `Invalid date string in notification: ${String(value)}`
    );
  }
  return new Date(ms);
}

export function parseData(raw: string): Record<string, unknown> | null {
  if (!raw) return null;
  if (raw === '<<NULL>>') return null;
  if (raw === '<<SERIALIZE_ERROR>>') return null;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return null;
  }
}

function toSnapshot(record: NotificationModel): NotificationSnapshot {
  return {
    id: record.id,
    type: record.type,
    title: record.title,
    body: record.body,
    data: parseData(record.data),
    deepLink: record.deepLink ?? null,
    createdAt: record.createdAt,
    readAt: record.readAt ?? null,
    expiresAt: record.expiresAt ?? null,
    archivedAt: record.archivedAt ?? null,
    deletedAt: record.deletedAt ?? null,
    messageId: record.messageId ?? null,
  };
}
