/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/consistent-type-imports */
// Mock storage to avoid native MMKV
jest.mock('@/lib/storage', () => {
  const store = new Map<string, any>();
  return {
    getItem: jest.fn((key: string) => (store.has(key) ? store.get(key) : null)),
    setItem: jest.fn((key: string, value: any) => {
      store.set(key, value);
    }),
    removeItem: jest.fn((key: string) => store.delete(key)),
    __reset: () => store.clear(),
  };
});

// Minimal Sentry mock for context updates
jest.mock('@sentry/react-native', () => ({
  setContext: jest.fn(),
}));

beforeEach(() => {
  jest.resetModules();
});

test('getPrivacyConsent returns defaults when storage empty and populates cache', async () => {
  jest.isolateModules(() => {
    // Arrange
    const { getPrivacyConsent } =
      require('@/lib/privacy-consent') as typeof import('@/lib/privacy-consent');

    // Act
    const consent = getPrivacyConsent();

    // Assert (subset of defaults)
    expect(consent.analytics).toBe(false);
    expect(consent.crashReporting).toBe(true);
    expect(consent.personalizedData).toBe(false);
    expect(consent.sessionReplay).toBe(false);
    expect(typeof consent.lastUpdated).toBe('number');
  });
});

test('setPrivacyConsent merges, persists, updates lastUpdated and Sentry context', async () => {
  jest.isolateModules(() => {
    const Sentry = require('@sentry/react-native') as {
      setContext: jest.Mock;
    };
    const { getPrivacyConsent, setPrivacyConsent } =
      require('@/lib/privacy-consent') as typeof import('@/lib/privacy-consent');

    const before = getPrivacyConsent();
    setPrivacyConsent({ analytics: true });
    const after = getPrivacyConsent();

    expect(before.analytics).toBe(false);
    expect(after.analytics).toBe(true);
    expect(after.crashReporting).toBe(true);
    expect(typeof after.lastUpdated).toBe('number');

    expect(Sentry.setContext).toHaveBeenCalledWith(
      'privacy_consent',
      expect.objectContaining({
        analytics: true,
        crashReporting: true,
        personalizedData: false,
        sessionReplay: false,
      })
    );
  });
});

test('hasConsent reads current value', async () => {
  jest.isolateModules(() => {
    const { hasConsent, setPrivacyConsent } =
      require('@/lib/privacy-consent') as typeof import('@/lib/privacy-consent');

    expect(hasConsent('analytics')).toBe(false);
    setPrivacyConsent({ analytics: true });
    expect(hasConsent('analytics')).toBe(true);
  });
});

test('initializePrivacyConsent populates Sentry context from stored state', async () => {
  jest.isolateModules(() => {
    const Sentry = require('@sentry/react-native') as {
      setContext: jest.Mock;
    };
    const { initializePrivacyConsent, setPrivacyConsent } =
      require('@/lib/privacy-consent') as typeof import('@/lib/privacy-consent');

    setPrivacyConsent({ analytics: true, sessionReplay: true });
    Sentry.setContext.mockClear();
    initializePrivacyConsent();

    expect(Sentry.setContext).toHaveBeenCalledWith(
      'privacy_consent',
      expect.objectContaining({ analytics: true, sessionReplay: true })
    );
  });
});

test('getPrivacyConsent handles storage errors and falls back to defaults', async () => {
  // Force getItem to throw
  jest.doMock('@/lib/storage', () => ({
    getItem: jest.fn(() => {
      throw new Error('boom');
    }),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  }));

  jest.isolateModules(() => {
    const { getPrivacyConsent } =
      require('@/lib/privacy-consent') as typeof import('@/lib/privacy-consent');
    const consent = getPrivacyConsent();
    expect(consent.crashReporting).toBe(true);
  });
});
