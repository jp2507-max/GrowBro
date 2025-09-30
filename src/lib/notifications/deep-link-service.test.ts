import { jest } from '@jest/globals';

async function loadService() {
  jest.doMock('expo-router', () => ({
    router: { push: jest.fn() },
  }));
  const module = await import('./deep-link-service');
  const { router } = await import('expo-router');
  return {
    DeepLinkService: module.DeepLinkService,
    router: router as unknown as { push: jest.Mock },
  };
}

async function loadGate() {
  const gate = await import('@/lib/navigation/deep-link-gate');
  gate.clearPendingDeepLink();
  return {
    consumePendingDeepLink: gate.consumePendingDeepLink,
    clearPendingDeepLink: gate.clearPendingDeepLink,
  };
}

describe('DeepLinkService.handle', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('defers protected navigation when authentication fails', async () => {
    const { DeepLinkService, router } = await loadService();
    const { consumePendingDeepLink } = await loadGate();
    const ensureAuthenticated = jest.fn<() => Promise<boolean>>(
      async () => false
    );

    const result = await DeepLinkService.handle('growbro://post/123', {
      ensureAuthenticated,
    });

    expect(result).toEqual({ ok: false, reason: 'auth-required' });
    expect(consumePendingDeepLink()).toBe('/post/123');
    expect(router.push).not.toHaveBeenCalled();
  });

  test('navigates to protected path when authenticated', async () => {
    const { DeepLinkService, router } = await loadService();
    await loadGate();
    const ensureAuthenticated = jest.fn<() => Promise<boolean>>(
      async () => true
    );

    const result = await DeepLinkService.handle('growbro://post/99', {
      ensureAuthenticated,
    });

    expect(result).toEqual({ ok: true, path: '/post/99' });
    expect(router.push).toHaveBeenCalledWith('/post/99');
  });

  test('allows public paths without authentication', async () => {
    const { DeepLinkService, router } = await loadService();
    await loadGate();
    const ensureAuthenticated = jest.fn<() => Promise<boolean>>(
      async () => false
    );

    const result = await DeepLinkService.handle('growbro://login', {
      ensureAuthenticated,
    });

    expect(result).toEqual({ ok: true, path: '/login' });
    expect(router.push).toHaveBeenCalledWith('/login');
  });
});
