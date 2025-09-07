import { create } from 'zustand';

import { getItem, setItem } from '@/lib/storage';
import { createSelectors } from '@/lib/utils';

const STORAGE_KEY = 'sync.prefs';

export type SyncPreferencesState = {
  autoSyncEnabled: boolean;
  backgroundSyncEnabled: boolean;
  requiresWifi: boolean;
  requiresCharging: boolean;
  stalenessHours: number; // threshold for stale data indicator

  hydrate: () => void;
  setAutoSyncEnabled: (value: boolean) => void;
  setBackgroundSyncEnabled: (value: boolean) => void;
  setRequiresWifi: (value: boolean) => void;
  setRequiresCharging: (value: boolean) => void;
  setStalenessHours: (value: number) => void;
};

function loadStored(): Partial<SyncPreferencesState> {
  const raw = getItem<Partial<SyncPreferencesState>>(STORAGE_KEY);
  if (!raw || typeof raw !== 'object') return {};
  return raw;
}

function persist(next: SyncPreferencesState): void {
  void setItem(STORAGE_KEY, {
    autoSyncEnabled: next.autoSyncEnabled,
    backgroundSyncEnabled: next.backgroundSyncEnabled,
    requiresWifi: next.requiresWifi,
    requiresCharging: next.requiresCharging,
    stalenessHours: next.stalenessHours,
  });
}

const DEFAULTS: Omit<
  SyncPreferencesState,
  | 'hydrate'
  | 'setAutoSyncEnabled'
  | 'setBackgroundSyncEnabled'
  | 'setRequiresWifi'
  | 'setRequiresCharging'
  | 'setStalenessHours'
> = {
  autoSyncEnabled: true,
  backgroundSyncEnabled: true,
  requiresWifi: false,
  requiresCharging: false,
  stalenessHours: 24,
};

const _useSyncPrefs = create<SyncPreferencesState>((set, get) => ({
  ...DEFAULTS,
  hydrate: () => {
    const stored = loadStored();
    if (stored) {
      set({
        autoSyncEnabled: stored.autoSyncEnabled ?? DEFAULTS.autoSyncEnabled,
        backgroundSyncEnabled:
          stored.backgroundSyncEnabled ?? DEFAULTS.backgroundSyncEnabled,
        requiresWifi: stored.requiresWifi ?? DEFAULTS.requiresWifi,
        requiresCharging: stored.requiresCharging ?? DEFAULTS.requiresCharging,
        stalenessHours: stored.stalenessHours ?? DEFAULTS.stalenessHours,
      });
    }
  },
  setAutoSyncEnabled: (value) => {
    set({ autoSyncEnabled: value });
    persist(get());
  },
  setBackgroundSyncEnabled: (value) => {
    set({ backgroundSyncEnabled: value });
    persist(get());
  },
  setRequiresWifi: (value) => {
    set({ requiresWifi: value });
    persist(get());
  },
  setRequiresCharging: (value) => {
    set({ requiresCharging: value });
    persist(get());
  },
  setStalenessHours: (value) => {
    const hours = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 24;
    set({ stalenessHours: hours });
    persist(get());
  },
}));

export const useSyncPrefs = createSelectors(_useSyncPrefs);

export function getSyncPrefs(): SyncPreferencesState {
  return _useSyncPrefs.getState();
}
