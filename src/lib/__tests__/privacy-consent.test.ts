import * as PrivacyConsentModule from '@/lib/privacy-consent';

jest.mock('@/lib/privacy/secure-config-store', () => {
  const store = new Map<string, any>();
  const api = {
    getSecureConfig: jest.fn(async (key: string) =>
      store.has(key) ? (store.get(key) as any) : null
    ),
    setSecureConfig: jest.fn(async (key: string, value: any) => {
      store.set(key, value);
    }),
    removeSecureConfig: jest.fn(async (key: string) => {
      store.delete(key);
    }),
    clearSecureConfigForTests: jest.fn(async () => {
      store.clear();
    }),
    resetSecureStoreAvailabilityForTests: jest.fn(),
  } as const;

  return {
    ...api,
    __store: store,
    __reset: () => {
      store.clear();
      Object.values(api).forEach((fn) => {
        if (typeof fn === 'function' && 'mockClear' in fn) {
          (fn as jest.Mock).mockClear();
        }
      });
    },
    __set: (key: string, value: any) => {
      store.set(key, value);
    },
  };
});

jest.mock('@sentry/react-native', () => ({
  setContext: jest.fn(),
}));

let secureStoreMock: any;
let sentryMock: { setContext: jest.Mock };

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(async () => {
  secureStoreMock = jest.requireMock(
    '@/lib/privacy/secure-config-store'
  ) as any;
  sentryMock = jest.requireMock('@sentry/react-native') as {
    setContext: jest.Mock;
  };
  secureStoreMock.__reset();
  sentryMock.setContext.mockClear();
  await PrivacyConsentModule.__resetPrivacyConsentForTests();
});

test('getPrivacyConsent returns defaults when secure store empty', async () => {
  const consent = PrivacyConsentModule.getPrivacyConsent();
  expect(consent.analytics).toBe(false);
  expect(consent.crashReporting).toBe(true);
  expect(consent.personalizedData).toBe(false);
  expect(consent.sessionReplay).toBe(false);
  expect(typeof consent.lastUpdated).toBe('number');
  expect(PrivacyConsentModule.getPrivacyConsentSync()).toEqual(consent);
});

test('setPrivacyConsent merges, persists, updates lastUpdated and Sentry context', async () => {
  const before = PrivacyConsentModule.getPrivacyConsent();
  PrivacyConsentModule.setPrivacyConsent({ analytics: true });
  await flushPromises();
  const storedArgs = secureStoreMock.setSecureConfig.mock.calls[0][1];
  const after = PrivacyConsentModule.getPrivacyConsent();

  expect(before.analytics).toBe(false);
  expect(after.analytics).toBe(true);
  expect(after.crashReporting).toBe(true);
  expect(typeof after.lastUpdated).toBe('number');
  expect(storedArgs.analytics).toBe(true);
  expect(sentryMock.setContext).toHaveBeenCalledWith(
    'privacy_consent',
    expect.objectContaining({
      analytics: true,
      crashReporting: true,
      personalizedData: false,
      sessionReplay: false,
    })
  );
});

test('hasConsent reflects latest persisted value', async () => {
  expect(PrivacyConsentModule.hasConsent('analytics')).toBe(false);
  PrivacyConsentModule.setPrivacyConsent({ analytics: true });
  await flushPromises();
  expect(PrivacyConsentModule.hasConsent('analytics')).toBe(true);
});

test('initializePrivacyConsent hydrates and updates Sentry context', async () => {
  secureStoreMock.__set('privacy-consent.v1', {
    analytics: true,
    sessionReplay: true,
    crashReporting: false,
    personalizedData: false,
    lastUpdated: 123,
  });

  sentryMock.setContext.mockClear();
  PrivacyConsentModule.initializePrivacyConsent();
  await flushPromises();

  expect(sentryMock.setContext).toHaveBeenCalledWith(
    'privacy_consent',
    expect.objectContaining({ analytics: true, sessionReplay: true })
  );
});

test('getPrivacyConsent falls back to defaults when secure storage throws', async () => {
  secureStoreMock.getSecureConfig.mockImplementationOnce(async () => {
    throw new Error('boom');
  });

  // Trigger hydration to exercise the error path
  PrivacyConsentModule.initializePrivacyConsent();
  await flushPromises();

  const consent = PrivacyConsentModule.getPrivacyConsent();
  expect(consent.crashReporting).toBe(true);
  expect(consent.analytics).toBe(false);
});
