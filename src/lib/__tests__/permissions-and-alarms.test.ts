import * as RN from 'react-native';
import { Linking } from 'react-native';

import { requestExactIfJustified, scheduleInexact } from '@/lib/alarms';
import { PermissionManager } from '@/lib/permissions/permission-manager';

describe('Exact alarm denied -> inexact fallback', () => {
  const originalOS = RN.Platform.OS;
  const originalVersion = RN.Platform.Version as any;
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(RN.Platform, 'OS', { value: 'android' });
    Object.defineProperty(RN.Platform, 'Version', { value: 34 });
  });
  afterEach(() => {
    Object.defineProperty(RN.Platform, 'OS', { value: originalOS });
    Object.defineProperty(RN.Platform, 'Version', { value: originalVersion });
  });

  it('falls back when requestExactAlarmIfJustified returns denied', async () => {
    jest
      .spyOn(PermissionManager, 'requestExactAlarmIfJustified')
      .mockResolvedValue({ status: 'denied', fallbackUsed: true });
    const when = new Date('2025-01-01T10:00:00Z');
    const exact = await requestExactIfJustified(when, { id: 't1' });
    expect(exact.exact).toBe(false);
    const inexact = await scheduleInexact(when, { id: 't1' });
    expect(inexact.id).toMatch(/^inexact-/);
    expect(inexact.exact).toBe(false);
  });
});

describe('Media permission reselection UI (stub)', () => {
  it('opens settings for reselection UI on Android', async () => {
    const spy = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    PermissionManager.showMediaReselectionUI();
    expect(spy).toHaveBeenCalled();
  });
});
