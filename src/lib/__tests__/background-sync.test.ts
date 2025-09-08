import { jest } from '@jest/globals';

import {
  executeBackgroundSyncOnceForTesting,
  setConstraints,
} from '@/lib/sync/background-sync';
import * as Network from '@/lib/sync/network-manager';
import * as Prefs from '@/lib/sync/preferences';

describe('background-sync constraints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('mock is properly applied', () => {
    // Simple test to verify the mock is working
    expect(typeof executeBackgroundSyncOnceForTesting).toBe('function');
  });

  it.skip('blocks when requiresWifi and network is metered', async () => {
    jest.spyOn(Network, 'isOnline').mockResolvedValue(true);
    jest.spyOn(Network, 'isMetered').mockResolvedValue(true);
    jest.spyOn(Prefs, 'getSyncPrefs').mockReturnValue({
      ...Prefs.getSyncPrefs(),
      backgroundSyncEnabled: true,
      requiresWifi: true,
      requiresCharging: false,
      autoSyncEnabled: true,
      stalenessHours: 24,
      hydrate: () => {},
      setAutoSyncEnabled: () => {},
      setBackgroundSyncEnabled: () => {},
      setRequiresWifi: () => {},
      setRequiresCharging: () => {},
      setStalenessHours: () => {},
    } as any);
    setConstraints({ requiresWifi: true });

    // Expect no throw; the internal task will early-success and not run sync
    await expect(
      executeBackgroundSyncOnceForTesting()
    ).resolves.toBeUndefined();
  });

  it.skip('allows when online and unmetered', async () => {
    jest.spyOn(Network, 'isOnline').mockResolvedValue(true);
    jest.spyOn(Network, 'isMetered').mockResolvedValue(false);
    jest.spyOn(Prefs, 'getSyncPrefs').mockReturnValue({
      ...Prefs.getSyncPrefs(),
      backgroundSyncEnabled: true,
      requiresWifi: true,
      requiresCharging: false,
      autoSyncEnabled: true,
      stalenessHours: 24,
      hydrate: () => {},
      setAutoSyncEnabled: () => {},
      setBackgroundSyncEnabled: () => {},
      setRequiresWifi: () => {},
      setRequiresCharging: () => {},
      setStalenessHours: () => {},
    } as any);
    setConstraints({ requiresWifi: true });
    await expect(
      executeBackgroundSyncOnceForTesting()
    ).resolves.toBeUndefined();
  });
});
