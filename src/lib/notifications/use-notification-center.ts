import { create, type StateCreator } from 'zustand';

import { updateAppBadgeCount } from '@/lib/notifications/notification-badge';
import {
  archiveNotifications,
  archiveOlderThan,
  listNotifications,
  type ListNotificationsResult,
  type NotificationSnapshot,
} from '@/lib/notifications/notification-storage';
import {
  cacheUnreadCount,
  deleteNotificationsRemote,
  flushPendingJobs,
  loadCachedUnreadCount,
  markNotificationsReadRemote,
  reconcileUnreadCount,
  syncNotificationInbox,
} from '@/lib/notifications/notification-sync';
import { createSelectors } from '@/lib/utils';

export type NotificationCenterStatus = 'idle' | 'loading' | 'ready' | 'error';

type NotificationCenterState = {
  status: NotificationCenterStatus;
  error: string | null;
  items: NotificationSnapshot[];
  localCursor: number | null;
  remoteCursor: string | null;
  includeArchived: boolean;
  unreadCount: number;
  isLoadingMore: boolean;
  initialize: (options?: { includeArchived?: boolean }) => Promise<void>;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  toggleArchived: (value: boolean) => Promise<void>;
  markAsRead: (ids: readonly string[]) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  archive: (ids: readonly string[]) => Promise<void>;
  delete: (ids: readonly string[]) => Promise<void>;
};

type StoreCreator = StateCreator<
  NotificationCenterState,
  [],
  [],
  NotificationCenterState
>;

type Setter = Parameters<StoreCreator>[0];

type Getter = Parameters<StoreCreator>[1];

const cachedUnreadCount = loadCachedUnreadCount();

void updateAppBadgeCount(cachedUnreadCount);

const _useNotificationCenter = create<NotificationCenterState>((set, get) => ({
  status: 'idle',
  error: null,
  items: [],
  localCursor: null,
  remoteCursor: null,
  includeArchived: false,
  unreadCount: cachedUnreadCount,
  isLoadingMore: false,
  initialize: createInitialize(set),
  refresh: createRefresh(set, get),
  loadMore: createLoadMore(set, get),
  toggleArchived: createToggleArchived(set),
  markAsRead: createMarkAsRead(set, get),
  markAllAsRead: createMarkAllAsRead(get),
  archive: createArchive(set, get),
  delete: createDelete(set, get),
}));

function createInitialize(set: Setter) {
  return async (options?: { includeArchived?: boolean }) => {
    const includeArchived = options?.includeArchived ?? false;
    set({ status: 'loading', error: null, includeArchived, items: [] });
    try {
      await archiveOlderThan();
      await flushPendingJobs();
      const page = await syncNotificationInbox({ includeArchived });
      set({ remoteCursor: page.nextCursor ?? null });
      await hydrateFromStorage({ includeArchived, reset: true });
      const unread = await reconcileUnreadCount();
      cacheUnreadCount(unread);
      set({ status: 'ready', unreadCount: unread });
      await updateAppBadgeCount(unread);
    } catch (error) {
      set({
        status: 'error',
        error: error instanceof Error ? error.message : 'unknown-error',
      });
    }
  };
}

function createRefresh(set: Setter, get: Getter) {
  return async () => {
    const includeArchived = get().includeArchived;
    set({ status: 'loading', error: null });
    try {
      const page = await syncNotificationInbox({ includeArchived });
      set({ remoteCursor: page.nextCursor ?? null });
      await hydrateFromStorage({ includeArchived, reset: true });
      const unread = await reconcileUnreadCount();
      cacheUnreadCount(unread);
      set({ status: 'ready', unreadCount: unread });
      await updateAppBadgeCount(unread);
    } catch (error) {
      set({
        status: 'error',
        error: error instanceof Error ? error.message : 'unknown-error',
      });
    }
  };
}

function createLoadMore(set: Setter, get: Getter) {
  return async () => {
    const state = get();
    if (state.isLoadingMore) return;
    set({ isLoadingMore: true });
    try {
      const includeArchived = state.includeArchived;
      const result = await hydrateFromStorage({
        includeArchived,
        cursor: state.localCursor,
      });
      if ((result?.items.length ?? 0) === 0 && state.remoteCursor) {
        const remotePage = await syncNotificationInbox({
          cursor: state.remoteCursor,
          includeArchived,
        });
        set({ remoteCursor: remotePage.nextCursor ?? null });
        await hydrateFromStorage({
          includeArchived,
          cursor: state.localCursor,
        });
      }
      set({ isLoadingMore: false });
    } catch (error) {
      set({
        isLoadingMore: false,
        status: 'error',
        error: error instanceof Error ? error.message : 'unknown-error',
      });
    }
  };
}

function createToggleArchived(set: Setter) {
  return async (value: boolean) => {
    set({ includeArchived: value });
    await hydrateFromStorage({ includeArchived: value, reset: true });
  };
}

function createMarkAsRead(set: Setter, get: Getter) {
  return async (ids: readonly string[]) => {
    if (!ids.length) return;
    const now = new Date();
    try {
      await markNotificationsReadRemote(ids, now);
      await hydrateFromStorage({
        includeArchived: get().includeArchived,
        reset: true,
      });
      const unread = await reconcileUnreadCount();
      cacheUnreadCount(unread);
      set({ unreadCount: unread, status: 'ready' });
      await updateAppBadgeCount(unread);
    } catch (error) {
      set({
        status: 'error',
        error: error instanceof Error ? error.message : 'unknown-error',
      });
    }
  };
}

function createMarkAllAsRead(get: Getter) {
  return async () => {
    const record = get();
    const unreadIds = record.items
      .filter((item: NotificationSnapshot) => !item.readAt && !item.deletedAt)
      .map((item: NotificationSnapshot) => item.id);
    if (unreadIds.length === 0) return;
    await record.markAsRead(unreadIds);
  };
}

function createArchive(set: Setter, get: Getter) {
  return async (ids: readonly string[]) => {
    if (!ids.length) return;
    try {
      await archiveNotifications(ids);
      await hydrateFromStorage({
        includeArchived: get().includeArchived,
        reset: true,
      });
    } catch (error) {
      set({
        status: 'error',
        error: error instanceof Error ? error.message : 'unknown-error',
      });
    }
  };
}

function createDelete(set: Setter, get: Getter) {
  return async (ids: readonly string[]) => {
    if (!ids.length) return;
    try {
      await deleteNotificationsRemote(ids);
      await hydrateFromStorage({
        includeArchived: get().includeArchived,
        reset: true,
      });
      const unread = await reconcileUnreadCount();
      cacheUnreadCount(unread);
      set({ unreadCount: unread, status: 'ready' });
      await updateAppBadgeCount(unread);
    } catch (error) {
      set({
        status: 'error',
        error: error instanceof Error ? error.message : 'unknown-error',
      });
    }
  };
}

async function hydrateFromStorage({
  includeArchived,
  cursor,
  reset = false,
}: {
  includeArchived: boolean;
  cursor?: number | null;
  reset?: boolean;
}): Promise<ListNotificationsResult | null> {
  const state = _useNotificationCenter.getState();
  const effectiveCursor = reset ? null : (cursor ?? state.localCursor);
  const result = await listNotifications({
    cursor: effectiveCursor,
    includeArchived,
    includeDeleted: false,
  });
  const items = reset ? result.items : [...state.items, ...result.items];
  _useNotificationCenter.setState({
    items,
    localCursor: result.nextCursor,
    status: 'ready',
    error: null,
  });
  return result;
}

export const useNotificationCenter = createSelectors(_useNotificationCenter);

export function getNotificationUnreadCount(): number {
  return _useNotificationCenter.getState().unreadCount;
}

export async function refreshNotificationInbox(): Promise<void> {
  await _useNotificationCenter.getState().refresh();
}

export async function loadNextNotifications(): Promise<void> {
  await _useNotificationCenter.getState().loadMore();
}
