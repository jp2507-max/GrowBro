/**
 * Zustand store for managing favorite strains with offline-first persistence
 */

import { create } from 'zustand';

import { getOptionalAuthenticatedUserId } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { createSelectors } from '@/lib/utils';
import { database } from '@/lib/watermelon';
import { createFavoritesRepository } from '@/lib/watermelon-models/favorites-repository';
import type { FavoritesIndex, FavoriteStrain, Strain } from '@/types/strains';

/**
 * Track favorite analytics (non-blocking)
 */
async function trackFavoriteAnalytics(
  action: 'added' | 'removed',
  strainId: string,
  totalFavorites: number
): Promise<void> {
  try {
    const { getAnalyticsClient } = await import('@/lib/analytics-registry');
    const { trackStrainFavoriteAdded, trackStrainFavoriteRemoved } =
      await import('./strains-analytics');

    const analytics = getAnalyticsClient();

    if (action === 'added') {
      trackStrainFavoriteAdded(analytics, {
        strainId,
        source: 'detail', // Default to detail, can be overridden by caller
        totalFavorites,
      });
    } else {
      trackStrainFavoriteRemoved(analytics, {
        strainId,
        source: 'detail', // Default to detail, can be overridden by caller
        totalFavorites,
      });
    }
  } catch (error) {
    // Silently fail analytics to not impact user experience
    console.debug('[useFavorites] Analytics tracking failed:', error);
  }
}

interface FavoritesState {
  favorites: FavoritesIndex;
  isHydrated: boolean;
  isSyncing: boolean;
  lastSyncAt: number | null;
  syncError: string | null;
  addFavorite: (strain: Strain) => Promise<void>;
  removeFavorite: (strainId: string) => Promise<void>;
  isFavorite: (strainId: string) => boolean;
  getFavorites: () => FavoriteStrain[];
  syncToCloud: () => Promise<void>;
  pullFromCloud: () => Promise<void>;
  fullSync: () => Promise<void>;
  hydrate: () => Promise<void>;
  setFavorites: (favorites: FavoritesIndex) => void;
  setSyncing: (isSyncing: boolean) => void;
  setSyncError: (error: string | null) => void;
}

function toFavoritesIndex(favoritesArray: FavoriteStrain[]): FavoritesIndex {
  const index: FavoritesIndex = {};
  for (const favorite of favoritesArray) {
    index[favorite.id] = favorite;
    if (favorite.snapshot.slug) {
      index[favorite.snapshot.slug] = favorite;
    }
  }
  return index;
}

async function performCloudSync(userId: string): Promise<number> {
  const repo = createFavoritesRepository(database);
  const favoritesNeedingSync = await repo.getAllFavoritesNeedingSync(userId);
  if (favoritesNeedingSync.length === 0) {
    return 0;
  }
  const upsertData = favoritesNeedingSync.map((favorite) => ({
    user_id: userId,
    strain_id: favorite.strainId,
    added_at: favorite.addedAt,
    snapshot: favorite.snapshot,
    updated_at: favorite.updatedAt.toISOString(),
    deleted_at: favorite.deletedAt?.toISOString() || null,
  }));
  const { error } = await supabase.from('favorites').upsert(upsertData, {
    onConflict: 'user_id,strain_id',
    ignoreDuplicates: false,
  });
  if (error) {
    throw new Error(`Supabase sync failed: ${error.message}`);
  }
  const syncedIds = favoritesNeedingSync.map((f) => f.id);
  await repo.markAsSynced(syncedIds);
  return favoritesNeedingSync.length;
}

async function hydrateFromDb(
  setFavorites: (favorites: FavoritesIndex) => void
): Promise<void> {
  try {
    const repo = createFavoritesRepository(database);
    const userId = await getOptionalAuthenticatedUserId();
    const favoritesArray = await repo.getAllAsFavoriteStrains(
      userId || undefined
    );
    const favoritesIndex = toFavoritesIndex(favoritesArray);
    setFavorites(favoritesIndex);
  } catch (error) {
    console.error('[useFavorites] Hydration failed:', error);
    throw error;
  }
}

async function addFavoriteToDb(
  strain: Strain,
  updateState: (favorite: FavoriteStrain) => void,
  triggerSync: () => void
): Promise<void> {
  try {
    const repo = createFavoritesRepository(database);
    const userId = await getOptionalAuthenticatedUserId();
    await repo.addFavorite(strain, userId || undefined);
    const favorite: FavoriteStrain = {
      id: strain.id,
      addedAt: Date.now(),
      snapshot: {
        id: strain.id,
        slug: strain.slug,
        name: strain.name,
        race: strain.race,
        thc_display: strain.thc_display,
        imageUrl: strain.imageUrl,
      },
    };
    updateState(favorite);
    if (userId) {
      triggerSync();
    }
  } catch (error) {
    console.error('[useFavorites] Failed to add favorite:', error);
    throw error;
  }
}

async function removeFavoriteFromDb(
  strainId: string,
  updateState: () => void,
  triggerSync: () => void
): Promise<void> {
  try {
    const repo = createFavoritesRepository(database);
    const userId = await getOptionalAuthenticatedUserId();
    await repo.removeFavorite(strainId, userId || undefined);
    updateState();
    if (userId) {
      triggerSync();
    }
  } catch (error) {
    console.error('[useFavorites] Failed to remove favorite:', error);
    throw error;
  }
}

interface SyncContext {
  isSyncing: boolean;
  setSyncing: (syncing: boolean) => void;
  setSyncError: (error: string | null) => void;
  setLastSync: (timestamp: number) => void;
}

async function syncToCloudImpl(context: SyncContext): Promise<void> {
  const { isSyncing, setSyncing, setSyncError, setLastSync } = context;
  if (isSyncing) {
    return;
  }
  try {
    setSyncing(true);
    setSyncError(null);
    const userId = await getOptionalAuthenticatedUserId();
    if (!userId) {
      return;
    }
    await performCloudSync(userId);
    setLastSync(Date.now());

    // Store last sync time
    const { storage } = await import('@/lib/storage');
    storage.set('favorites_last_sync_at', Date.now());
    storage.delete('favorites_last_sync_error');
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown sync error';
    console.error('[useFavorites] Sync to cloud failed:', error);
    setSyncError(errorMessage);

    // Store sync error
    const { storage } = await import('@/lib/storage');
    storage.set('favorites_last_sync_error', errorMessage);

    throw error;
  } finally {
    setSyncing(false);
  }
}

async function pullFromCloudImpl(
  context: SyncContext & { hydrate: () => Promise<void> }
): Promise<void> {
  const { isSyncing, setSyncing, setSyncError, hydrate } = context;
  if (isSyncing) return;

  try {
    setSyncing(true);
    setSyncError(null);

    const { pullFavoritesFromCloud } = await import('./favorites-sync-queue');
    const pulled = await pullFavoritesFromCloud();

    console.info(`[useFavorites] Pulled ${pulled} favorites from cloud`);
    await hydrate();

    const { storage } = await import('@/lib/storage');
    storage.set('favorites_last_sync_at', Date.now());
    context.setLastSync(Date.now());
    storage.delete('favorites_last_sync_error');
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown pull error';
    console.error('[useFavorites] Pull from cloud failed:', error);
    setSyncError(errorMessage);

    const { storage } = await import('@/lib/storage');
    storage.set('favorites_last_sync_error', errorMessage);
  } finally {
    setSyncing(false);
  }
}

// eslint-disable-next-line max-lines-per-function
const _useFavorites = create<FavoritesState>((set, get) => ({
  favorites: {},
  isHydrated: false,
  isSyncing: false,
  lastSyncAt: null,
  syncError: null,
  setFavorites: (favorites: FavoritesIndex) => {
    set({ favorites, isHydrated: true });
  },
  setSyncing: (isSyncing: boolean) => set({ isSyncing }),
  setSyncError: (error: string | null) => set({ syncError: error }),
  hydrate: async () => {
    await hydrateFromDb(get().setFavorites).catch(() => {
      set({ isHydrated: true });
    });
  },
  addFavorite: async (strain: Strain) => {
    await addFavoriteToDb(
      strain,
      (favorite) => {
        set((state) => {
          const favorites = { ...state.favorites, [strain.id]: favorite };
          if (strain.slug) {
            favorites[strain.slug] = favorite;
          }
          return { favorites };
        });
      },
      () => {
        void get()
          .syncToCloud()
          .catch((e) => {
            console.error('[useFavorites] Background sync failed:', e);
          });
      }
    );

    // Track analytics (non-blocking)
    void trackFavoriteAnalytics(
      'added',
      strain.id,
      get().getFavorites().length
    );
  },
  removeFavorite: async (strainId: string) => {
    await removeFavoriteFromDb(
      strainId,
      () => {
        set((state) => {
          const newFavorites = { ...state.favorites };
          const favorite = newFavorites[strainId];

          if (favorite) {
            delete newFavorites[favorite.id];
            if (favorite.snapshot.slug) {
              delete newFavorites[favorite.snapshot.slug];
            }
          } else {
            for (const key of Object.keys(newFavorites)) {
              const candidate = newFavorites[key];
              if (candidate.snapshot.slug === strainId) {
                delete newFavorites[candidate.id];
                if (candidate.snapshot.slug) {
                  delete newFavorites[candidate.snapshot.slug];
                }
                break;
              }
            }
          }

          return { favorites: newFavorites };
        });
      },
      () => {
        void get()
          .syncToCloud()
          .catch((e) => {
            console.error('[useFavorites] Background sync failed:', e);
          });
      }
    );

    // Track analytics (non-blocking)
    void trackFavoriteAnalytics(
      'removed',
      strainId,
      get().getFavorites().length
    );
  },
  isFavorite: (strainId: string) => get().favorites[strainId] !== undefined,
  getFavorites: () => {
    const { favorites } = get();
    const unique = new Map<string, FavoriteStrain>();
    for (const favorite of Object.values(favorites)) {
      unique.set(favorite.id, favorite);
    }
    return Array.from(unique.values()).sort((a, b) => b.addedAt - a.addedAt);
  },
  syncToCloud: async () => {
    const { isSyncing, setSyncing, setSyncError } = get();
    await syncToCloudImpl({
      isSyncing,
      setSyncing,
      setSyncError,
      setLastSync: (timestamp) =>
        set({ lastSyncAt: timestamp, syncError: null }),
    });
  },
  pullFromCloud: async () => {
    const { isSyncing, setSyncing, setSyncError, hydrate } = get();
    await pullFromCloudImpl({
      isSyncing,
      setSyncing,
      setSyncError,
      hydrate,
      setLastSync: (timestamp) =>
        set({ lastSyncAt: timestamp, syncError: null }),
    });
  },
  fullSync: async () => {
    const { pullFromCloud, syncToCloud } = get();
    await pullFromCloud();
    await syncToCloud();
  },
}));

export const useFavorites = createSelectors(_useFavorites);

export function getFavoritesState(): FavoritesState {
  return _useFavorites.getState();
}

export function subscribeFavorites(callback: (state: FavoritesState) => void) {
  return _useFavorites.subscribe(callback);
}

/**
 * Hydrate favorites from local DB.
 * Call this during app startup to ensure favorites are loaded before UI renders.
 * Safe to call multiple times - subsequent calls are quick no-ops if already hydrated.
 */
export async function hydrateFavorites(): Promise<void> {
  const state = _useFavorites.getState();
  if (state.isHydrated) {
    return; // Already hydrated, skip
  }
  await state.hydrate();
}
