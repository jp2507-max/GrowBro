const setBadgeCountMock = jest.fn(async (_count: number) => {});

async function importModule() {
  jest.doMock('expo-notifications', () => ({
    setBadgeCountAsync: setBadgeCountMock,
  }));
  return import('@/lib/notifications/notification-badge');
}

describe('notification-badge', () => {
  beforeEach(() => {
    jest.resetModules();
    setBadgeCountMock.mockReset();
  });

  test('sanitizes badge counts', async () => {
    const module = await importModule();

    expect(module.__sanitizeBadgeCount(-5)).toBe(0);
    expect(module.__sanitizeBadgeCount(Number.POSITIVE_INFINITY)).toBe(0);
    expect(module.__sanitizeBadgeCount(3.9)).toBe(3);
    expect(module.__sanitizeBadgeCount(4)).toBe(4);
  });

  test('updates badge count with sanitized value', async () => {
    const module = await importModule();

    await module.updateAppBadgeCount(7.8);

    expect(setBadgeCountMock).toHaveBeenCalledWith(7);
  });

  test('logs warning when update fails', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    setBadgeCountMock.mockRejectedValueOnce(new Error('boom'));
    const module = await importModule();

    await expect(module.updateAppBadgeCount(4)).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledWith(
      '[notification-badge] failed to update badge',
      'Error: boom'
    );
    warnSpy.mockRestore();
  });
});
