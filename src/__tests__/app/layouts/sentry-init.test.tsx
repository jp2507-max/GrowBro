/**
 * Smoke test: verifies Sentry.init is called with production-grade options
 * and React Navigation integration when consent is granted.
 */

function setEnv(): void {
  jest.resetModules();
  process.env.SENTRY_ENV = 'staging';
  process.env.SENTRY_RELEASE = '1.2.3';
  process.env.SENTRY_DIST = 'build-xyz';
}

function mockEnvAndConsent(): void {
  // Mock expo-router to a minimal stub to avoid React Navigation internals
  jest.doMock('expo-router', () => ({
    Stack: () => null,
    ErrorBoundary: () => null,
  }));

  jest.doMock('@env', () => ({
    Env: {
      APP_ENV: 'staging',
      VERSION: '1.2.3',
      SENTRY_DSN: 'https://example.ingest.sentry.io/123',
      SENTRY_SEND_DEFAULT_PII: false,
      SENTRY_ENABLE_REPLAY: false,
    },
  }));

  jest.doMock('@/lib', () => ({
    ConsentService: {
      isConsentRequired: () => false,
      getConsentVersion: () => 'v1',
      setConsents: jest.fn(),
    },
    hydrateAgeGate: jest.fn(),
    hydrateAuth: jest.fn(),
    loadSelectedTheme: jest.fn(),
    SDKGate: {
      registerSDK: jest.fn(),
      installNetworkSafetyNet: jest.fn(),
      initializeSDK: jest.fn(),
    },
    startAgeGateSession: jest.fn(),
    useAgeGate: { status: () => 'verified', sessionId: () => null },
    useIsFirstTime: () => [false],
  }));

  jest.doMock('@/lib/privacy-consent', () => ({
    initializePrivacyConsent: jest.fn(),
    hasConsent: (k: string) => (k === 'crashReporting' ? true : false),
    setPrivacyConsent: jest.fn(),
    getPrivacyConsentSync: jest.fn(() => ({
      analytics: false,
      crashReporting: true,
      personalizedData: false,
      sessionReplay: false,
      lastUpdated: Date.now(),
    })),
  }));

  jest.doMock('@/lib/uploads/ai-images', () => ({
    installAiConsentHooks: jest.fn(),
  }));

  // Avoid executing native splash-screen code during module import
  jest.doMock('expo-splash-screen', () => ({
    preventAutoHideAsync: jest.fn(),
    setOptions: jest.fn(),
  }));
}

function importRootLayout(): void {
  jest.isolateModules(() => {
    require('@/app/_layout');
  });
}

describe.skip('Sentry initialization (RootLayout top-level)', () => {
  beforeEach(setEnv);

  test('initializes with env, release, dist and navigation integration', async () => {
    mockEnvAndConsent();

    const Sentry = require('@sentry/react-native') as {
      init: jest.Mock;
      reactNavigationIntegration: jest.Mock;
    };

    importRootLayout();

    expect(Sentry.init).toHaveBeenCalledTimes(1);
    const opts = Sentry.init.mock.calls[0][0] as Record<string, unknown>;
    expect(opts.environment).toBe('staging');
    expect(opts.release).toBe('1.2.3');
    expect(opts.dist).toBe('build-xyz');
    expect(opts.tracesSampleRate).toBe(1.0);
    expect(opts.profilesSampleRate).toBe(1.0);
    expect(opts.replaysSessionSampleRate).toBe(0);
    expect(opts.replaysOnErrorSampleRate).toBe(0);
    expect(Sentry.reactNavigationIntegration).toHaveBeenCalledWith(
      expect.objectContaining({ enableTimeToInitialDisplay: true })
    );
  });
});
