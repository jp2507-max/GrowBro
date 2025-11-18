import type { PrivacyConsent } from '@/lib/privacy-consent';

import type {
  logAuthError as logAuthErrorFn,
  trackAuthEvent as trackAuthEventFn,
} from '../auth-telemetry';

type AuthTelemetryModule = {
  logAuthError: typeof logAuthErrorFn;
  trackAuthEvent: typeof trackAuthEventFn;
};

const mockTrack = jest.fn();
const mockCreateConsentGatedAnalytics = jest.fn(() => ({
  track: mockTrack,
}));
const mockNoopAnalytics = {
  track: jest.fn(),
};
const mockRegisterSDK = jest.fn();
const mockInitializeSDK = jest.fn(() => Promise.resolve());
const mockBlockSDK = jest.fn();
const mockDigest = jest.fn();
const mockAddEventProcessor = jest.fn();
const scopeSetContext = jest.fn();
const scopeSetTag = jest.fn();
const scopeSetUser = jest.fn();
const mockCaptureException = jest.fn();
const mockWithScope = jest.fn((callback: any) => {
  callback({
    setContext: scopeSetContext,
    setTag: scopeSetTag,
    setUser: scopeSetUser,
  });
});
const mockBeforeSendHook = jest.fn((event: any) => event);

const consentListeners: ((consent: PrivacyConsent) => void)[] = [];
const defaultConsent: PrivacyConsent = {
  analytics: false,
  crashReporting: true,
  personalizedData: false,
  sessionReplay: false,
  aiModelImprovement: false,
  lastUpdated: 0,
};

let consentState: PrivacyConsent;

const mockHasConsent = jest.fn((feature: keyof PrivacyConsent) => {
  return Boolean(consentState?.[feature]);
});

const mockGetPrivacyConsent = jest.fn(() => consentState);

const mockOnPrivacyConsentChange = jest.fn(
  (cb: (consent: PrivacyConsent) => void) => {
    consentListeners.push(cb);
    return jest.fn();
  }
);

function resetConsentOverrides(overrides: Partial<PrivacyConsent>): void {
  consentState = {
    ...defaultConsent,
    ...overrides,
  };
}

async function loadTelemetryModule(overrides: Partial<PrivacyConsent> = {}) {
  consentListeners.length = 0;
  jest.resetModules();
  jest.clearAllMocks();

  resetConsentOverrides(overrides);

  mockHasConsent.mockImplementation((feature: keyof PrivacyConsent) => {
    return Boolean(consentState?.[feature]);
  });
  mockGetPrivacyConsent.mockImplementation(() => consentState);
  mockOnPrivacyConsentChange.mockImplementation(
    (cb: (consent: PrivacyConsent) => void) => {
      consentListeners.push(cb);
      return jest.fn();
    }
  );
  mockDigest.mockImplementation(async (_algorithm: string, value: string) => {
    return `hashed:${value}`;
  });
  mockCreateConsentGatedAnalytics.mockImplementation(() => ({
    track: mockTrack,
  }));
  mockInitializeSDK.mockImplementation(() => Promise.resolve());

  jest.doMock('@/lib/privacy-consent', () => ({
    hasConsent: mockHasConsent,
    getPrivacyConsent: mockGetPrivacyConsent,
    onPrivacyConsentChange: mockOnPrivacyConsentChange,
  }));

  jest.doMock('@/lib/privacy/sdk-gate', () => ({
    SDKGate: {
      registerSDK: mockRegisterSDK,
      initializeSDK: mockInitializeSDK,
      blockSDK: mockBlockSDK,
    },
  }));

  jest.doMock('@/lib/analytics', () => ({
    createConsentGatedAnalytics: mockCreateConsentGatedAnalytics,
    NoopAnalytics: mockNoopAnalytics,
  }));

  jest.doMock('expo-crypto', () => ({
    digestStringAsync: mockDigest,
    CryptoDigestAlgorithm: {
      SHA256: 'SHA-256',
    },
  }));

  jest.doMock('@sentry/react-native', () => ({
    addEventProcessor: mockAddEventProcessor,
    withScope: mockWithScope,
    captureException: mockCaptureException,
  }));

  jest.doMock('@/lib/sentry-utils', () => ({
    beforeSendHook: mockBeforeSendHook,
  }));

  jest.doMock('@env', () => ({
    Env: {
      EMAIL_HASH_SALT: 'test-salt',
    },
  }));

  let telemetryModule: AuthTelemetryModule;
  jest.isolateModules(() => {
    telemetryModule = require('../auth-telemetry');
  });

  await Promise.resolve();
  await Promise.resolve();

  return telemetryModule!;
}

describe('auth telemetry helpers', () => {
  it('drops analytics events when analytics consent is denied', async () => {
    const { trackAuthEvent } = await loadTelemetryModule({ analytics: false });

    await trackAuthEvent('auth_sign_in', { user_id: 'user-1' });

    expect(mockHasConsent).toHaveBeenCalledWith('analytics');
    expect(mockTrack).not.toHaveBeenCalled();
    expect(mockDigest).not.toHaveBeenCalled();
  });

  it('sanitizes auth analytics payloads when consent granted', async () => {
    const { trackAuthEvent } = await loadTelemetryModule({ analytics: true });

    await trackAuthEvent('auth_sign_in', {
      email: 'User@Example.com',
      ip_address: '203.0.113.55',
      device_id: 'device-42',
      user_id: 'user-123',
    });

    expect(mockTrack).toHaveBeenCalledTimes(1);
    const [eventName, payload] = mockTrack.mock.calls[0];
    expect(eventName).toBe('auth_sign_in');
    expect(payload).toEqual(
      expect.objectContaining({
        email: 'hashed:test-saltuser@example.com',
        ip_address: '203.0.113.0',
        user_id: 'user-123',
        session_id: 'user-123',
      })
    );
    expect(payload).not.toHaveProperty('device_id');
    expect(typeof payload.timestamp).toBe('string');
  });

  it('skips Sentry logging when crash reporting consent is denied', async () => {
    const { logAuthError } = await loadTelemetryModule({
      crashReporting: false,
    });

    await logAuthError(new Error('boom'), {
      email: 'blocked@example.com',
    });

    expect(mockHasConsent).toHaveBeenCalledWith('crashReporting');
    expect(mockWithScope).not.toHaveBeenCalled();
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it('redacts auth error context when personalized data consent is disabled', async () => {
    const { logAuthError } = await loadTelemetryModule({
      crashReporting: true,
      personalizedData: false,
    });

    await logAuthError(new Error('auth failure'), {
      email: 'Sensitive@Example.com',
      ip_address: '10.0.0.42',
      password: 'Secret123!',
      user_id: 'user-99',
    });

    expect(mockWithScope).toHaveBeenCalled();
    expect(scopeSetTag).toHaveBeenCalledWith('auth_error', 'true');
    expect(scopeSetUser).not.toHaveBeenCalled();
    expect(scopeSetContext).toHaveBeenCalledWith(
      'auth_context',
      expect.objectContaining({
        email: 'hashed:test-saltsensitive@example.com',
        ip_address: '10.0.0.0',
        password: '[REDACTED]',
        user_id: 'user-99',
      })
    );
    expect(mockCaptureException).toHaveBeenCalled();
  });
});
