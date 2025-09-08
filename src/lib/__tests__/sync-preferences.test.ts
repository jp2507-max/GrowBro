import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import { getSyncPrefs, useSyncPrefs } from '@/lib/sync/preferences';

const mockStorage = (() => {
  const map = new Map<string, string>();
  return {
    storage: {
      getString: (k: string) => map.get(k),
      set: (k: string, v: string) => map.set(k, v),
      delete: (k: string) => map.delete(k),
    },
    getItem: <T>(k: string): T | null => {
      const v = map.get(k);
      return v ? (JSON.parse(v) as T) : null;
    },
    setItem: async <T>(k: string, v: T) => {
      map.set(k, JSON.stringify(v));
    },
    removeItem: async (k: string) => {
      map.delete(k);
    },
    clear: () => map.clear(),
  };
})();

jest.mock('@/lib/storage', () => mockStorage);

describe('sync preferences store', () => {
  beforeEach(() => {
    // Clear mock storage state between tests
    mockStorage.clear();

    // Reset Zustand store to defaults
    const prefs = getSyncPrefs();
    prefs.hydrate();
  });

  afterEach(() => {
    // Additional cleanup if needed
    mockStorage.clear();
  });
  it('hydrates defaults and updates', () => {
    const prefs = getSyncPrefs();
    expect(useSyncPrefs.getState().autoSyncEnabled).toBe(true);
    prefs.setRequiresWifi(true);
    expect(useSyncPrefs.getState().requiresWifi).toBe(true);
  });

  it('stores staleness hours as integer >= 0', () => {
    const prefs = getSyncPrefs();
    prefs.setStalenessHours(12.4);
    expect(useSyncPrefs.getState().stalenessHours).toBe(12);
    prefs.setStalenessHours(-5);
    expect(useSyncPrefs.getState().stalenessHours).toBe(0);
  });
});
