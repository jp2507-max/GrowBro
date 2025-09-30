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

let initializeInProgress = false;
let refreshInProgress = false;

const _useNotificationCenter = create<NotificationCenterState>((set, get) => ({
  status: 'idle',
  error: null,
  items: [],
  localCursor: null,
  remoteCursor: null,
  includeArchived: false,
  unreadCount: 0,
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
    if (initializeInProgress) return;
    initializeInProgress = true;
    try {
      const includeArchived = options?.includeArchived ?? false;
      set({ status: 'loading', error: null, includeArchived, items: [] });
      const initialUnreadCount = loadCachedUnreadCount();
      set({ unreadCount: initialUnreadCount });
      await updateAppBadgeCount(initialUnreadCount);

      await archiveOlderThan();
      await flushPendingJobs();
      const page = await syncNotificationInbox({ includeArchived });
      set({ remoteCursor: page.nextCursor ?? null });
      const hydrated = await hydrateFromStorage({
        includeArchived,
        reset: true,
      });
      set({
        items: hydrated.items,
        localCursor: hydrated.localCursor,
        status: 'ready',
        error: null,
      });
      const unread = await reconcileUnreadCount();
      cacheUnreadCount(unread);
      set({ status: 'ready', unreadCount: unread });
      await updateAppBadgeCount(unread);
    } catch (error) {
      set({
        status: 'error',
        error: error instanceof Error ? error.message : 'unknown-error',
      });
    } finally {
      initializeInProgress = false;
    }
  };
}

function createRefresh(set: Setter, get: Getter) {
  return async () => {
    if (refreshInProgress) return;
    refreshInProgress = true;
    try {
      const includeArchived = get().includeArchived;
      set({ status: 'loading', error: null });
      const page = await syncNotificationInbox({ includeArchived });
      set({ remoteCursor: page.nextCursor ?? null });
      const hydrated = await hydrateFromStorage({
        includeArchived,
        reset: true,
      });
      set({
        items: hydrated.items,
        localCursor: hydrated.localCursor,
        status: 'ready',
        error: null,
      });
      const unread = await reconcileUnreadCount();
      cacheUnreadCount(unread);
      set({ status: 'ready', unreadCount: unread });
      await updateAppBadgeCount(unread);
    } catch (error) {
      set({
        status: 'error',
        error: error instanceof Error ? error.message : 'unknown-error',
      });
    } finally {
      refreshInProgress = false;
    }
  };
}

function createLoadMore(set: Setter, get: Getter) {
  return async () => {
    const state = get();
    if (state.isLoadingMore || state.status === 'loading') return;
    set({ isLoadingMore: true });
    try {
      const includeArchived = state.includeArchived;
      const hydrated = await hydrateFromStorage({
        includeArchived,
        cursor: state.localCursor,
      });
      set({
        items: hydrated.items,
        localCursor: hydrated.localCursor,
        status: 'ready',
        error: null,
      });
      if ((hydrated.result.items.length ?? 0) === 0 && state.remoteCursor) {
        const remotePage = await syncNotificationInbox({
          cursor: state.remoteCursor,
          includeArchived,
        });
        set({ remoteCursor: remotePage.nextCursor ?? null });
        const hydratedAgain = await hydrateFromStorage({
          includeArchived,
          cursor: state.localCursor,
        });
        set({
          items: hydratedAgain.items,
          localCursor: hydratedAgain.localCursor,
          status: 'ready',
          error: null,
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
    const previousValue = _useNotificationCenter.getState().includeArchived;
    set({ includeArchived: value, status: 'loading', error: null });
    try {
      const hydrated = await hydrateFromStorage({
        includeArchived: value,
        reset: true,
      });
      set({
        items: hydrated.items,
        localCursor: hydrated.localCursor,
        status: 'ready',
        error: null,
      });
    } catch (error) {
      set({
        status: 'error',
        error: error instanceof Error ? error.message : 'unknown-error',
        includeArchived: previousValue,
      });
    }
  };
}

function createMarkAsRead(set: Setter, get: Getter) {
  return async (ids: readonly string[]) => {
    if (!ids.length) return;
    const now = new Date();
    try {
      await markNotificationsReadRemote(ids, now);
      const hydrated = await hydrateFromStorage({
        includeArchived: get().includeArchived,
        reset: true,
      });
      set({
        items: hydrated.items,
        localCursor: hydrated.localCursor,
        status: 'ready',
        error: null,
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
      const hydrated = await hydrateFromStorage({
        includeArchived: get().includeArchived,
        reset: true,
      });
      set({
        items: hydrated.items,
        localCursor: hydrated.localCursor,
        status: 'ready',
        error: null,
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
      const hydrated = await hydrateFromStorage({
        includeArchived: get().includeArchived,
        reset: true,
      });
      set({
        items: hydrated.items,
        localCursor: hydrated.localCursor,
        status: 'ready',
        error: null,
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
}): Promise<{
  items: NotificationSnapshot[];
  localCursor: number | null;
  result: ListNotificationsResult;
}> {
  const state = _useNotificationCenter.getState();
  const effectiveCursor = reset ? null : (cursor ?? state.localCursor);
  const result = await listNotifications({
    cursor: effectiveCursor,
    includeArchived,
    includeDeleted: false,
  });
  const items = reset ? result.items : [...state.items, ...result.items];
  return { items, localCursor: result.nextCursor, result };
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
