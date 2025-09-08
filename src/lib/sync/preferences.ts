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

// Only the persisted shape (no methods)
export type SyncPrefsSnapshot = Pick<
  SyncPreferencesState,
  | 'autoSyncEnabled'
  | 'backgroundSyncEnabled'
  | 'requiresWifi'
  | 'requiresCharging'
  | 'stalenessHours'
>;

function loadStored(): Partial<SyncPrefsSnapshot> {
  const raw = getItem<Partial<SyncPrefsSnapshot>>(STORAGE_KEY);
  if (!raw || typeof raw !== 'object') return {};
  return raw;
}

// Sanitization helpers
function sanitizeBoolean(value: any, defaultValue: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (lower === 'true' || lower === '1') return true;
    if (lower === 'false' || lower === '0') return false;
  }
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  return defaultValue;
}

function sanitizeStalenessHours(value: any, defaultValue: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Clamp to reasonable bounds (0 hours to 1 week/168 hours) and round to integer
    return Math.max(0, Math.min(168, Math.round(value)));
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.min(168, Math.round(parsed)));
    }
  }
  return defaultValue;
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

// TODO: Refactored to use SyncPrefsSnapshot for better maintainability and type safety
const DEFAULTS: SyncPrefsSnapshot = {
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
        autoSyncEnabled: sanitizeBoolean(
          stored.autoSyncEnabled,
          DEFAULTS.autoSyncEnabled
        ),
        backgroundSyncEnabled: sanitizeBoolean(
          stored.backgroundSyncEnabled,
          DEFAULTS.backgroundSyncEnabled
        ),
        requiresWifi: sanitizeBoolean(
          stored.requiresWifi,
          DEFAULTS.requiresWifi
        ),
        requiresCharging: sanitizeBoolean(
          stored.requiresCharging,
          DEFAULTS.requiresCharging
        ),
        stalenessHours: sanitizeStalenessHours(
          stored.stalenessHours,
          DEFAULTS.stalenessHours
        ),
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
    const sanitizedHours = sanitizeStalenessHours(
      value,
      DEFAULTS.stalenessHours
    );
    set({ stalenessHours: sanitizedHours });
    persist(get());
  },
}));

export const useSyncPrefs = createSelectors(_useSyncPrefs);

export function getSyncPrefs(): SyncPreferencesState {
  return _useSyncPrefs.getState();
}
