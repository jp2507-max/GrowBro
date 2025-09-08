import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import { getSyncPrefs, useSyncPrefs } from '@/lib/sync/preferences';

const mockStorageMap = new Map<string, string>();

jest.mock('@/lib/storage', () => ({
  getItem: <T>(k: string): T | null => {
    const v = mockStorageMap.get(k);
    return v ? (JSON.parse(v) as T) : null;
  },
  setItem: async <T>(k: string, v: T) => {
    mockStorageMap.set(k, JSON.stringify(v));
  },
  removeItem: async (k: string) => {
    mockStorageMap.delete(k);
  },
}));

describe('sync preferences store', () => {
  beforeEach(() => {
    // Clear mock storage state between tests
    mockStorageMap.clear();

    // Reset Zustand store to defaults
    const prefs = getSyncPrefs();
    prefs.hydrate();
  });

  afterEach(() => {
    // Additional cleanup if needed
    mockStorageMap.clear();
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
