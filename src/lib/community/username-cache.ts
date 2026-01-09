import { getItem, setItem, STORAGE_KEYS } from '@/lib/storage';

const MAX_ENTRIES = 500;

type UsernameCacheEntry = {
  username: string;
  updatedAt: number;
};

type UsernameCacheData = {
  updatedAt: number;
  entries: Record<string, UsernameCacheEntry>;
};

function pruneCache(entries: Record<string, UsernameCacheEntry>) {
  const ids = Object.keys(entries);
  if (ids.length <= MAX_ENTRIES) return entries;

  ids.sort((a, b) => entries[b].updatedAt - entries[a].updatedAt);
  const trimmed: Record<string, UsernameCacheEntry> = {};
  for (const id of ids.slice(0, MAX_ENTRIES)) {
    trimmed[id] = entries[id];
  }
  return trimmed;
}

export function getCachedUsernames(userIds: string[]): Map<string, string> {
  const cache = getItem<UsernameCacheData>(
    STORAGE_KEYS.COMMUNITY_USERNAMES_CACHE
  );
  const map = new Map<string, string>();
  if (!cache?.entries || userIds.length === 0) return map;

  for (const id of userIds) {
    const entry = cache.entries[id];
    if (entry?.username) {
      map.set(id, entry.username);
    }
  }

  return map;
}

export function setCachedUsernames(
  profiles: { id: string; username: string }[]
): void {
  if (!profiles.length) return;

  const now = Date.now();
  const cache =
    getItem<UsernameCacheData>(STORAGE_KEYS.COMMUNITY_USERNAMES_CACHE) ??
    ({ updatedAt: now, entries: {} } as UsernameCacheData);

  for (const profile of profiles) {
    if (!profile?.id || !profile.username) continue;
    cache.entries[profile.id] = {
      username: profile.username,
      updatedAt: now,
    };
  }

  cache.updatedAt = now;
  cache.entries = pruneCache(cache.entries);
  setItem(STORAGE_KEYS.COMMUNITY_USERNAMES_CACHE, cache);
}
