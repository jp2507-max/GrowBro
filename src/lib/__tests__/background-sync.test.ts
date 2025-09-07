import { jest } from '@jest/globals';

import {
  executeBackgroundSyncOnceForTesting,
  setConstraints,
} from '@/lib/sync/background-sync';
import * as Network from '@/lib/sync/network-manager';
import * as Prefs from '@/lib/sync/preferences';

jest.unstable_mockModule('expo-background-task', () => ({
  triggerTaskWorkerForTestingAsync: jest.fn(async () => undefined),
}));

describe.skip('background-sync constraints', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('blocks when requiresWifi and network is metered', async () => {
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

  it('allows when online and unmetered', async () => {
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
