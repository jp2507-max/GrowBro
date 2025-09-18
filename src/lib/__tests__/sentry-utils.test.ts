/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/consistent-type-imports */
// Mock dynamic imports in captureCategorizedErrorSync
jest.mock('@sentry/react-native', () => ({
  captureException: jest.fn(),
}));

jest.mock('@/lib/error-handling', () => ({
  categorizeError: (e: unknown) => ({
    category: 'test',
    isRetryable: false,
    statusCode: 0,
    message: String(e),
  }),
}));

test('beforeSendHook drops event when crashReporting not consented', () => {
  jest.doMock('@/lib/privacy-consent', () => ({
    getPrivacyConsentSync: jest.fn(() => ({
      analytics: false,
      crashReporting: false,
      personalizedData: false,
      sessionReplay: false,
      lastUpdated: Date.now(),
    })),
  }));

  jest.isolateModules(() => {
    const { beforeSendHook: hook } =
      require('@/lib/sentry-utils') as typeof import('@/lib/sentry-utils');
    const result = hook({ message: 'test' });
    expect(result).toBeNull();
  });
});

test('beforeSendHook scrubs PII from strings in event fields', () => {
  jest.doMock('@/lib/privacy-consent', () => ({
    getPrivacyConsentSync: jest.fn(() => ({
      analytics: false,
      crashReporting: true,
      personalizedData: false,
      sessionReplay: false,
      lastUpdated: Date.now(),
    })),
  }));

  jest.isolateModules(() => {
    const { beforeSendHook: hook } =
      require('@/lib/sentry-utils') as typeof import('@/lib/sentry-utils');
    const event = {
      exception: {
        values: [
          {
            value:
              'User email is john.doe@example.com and card 4111 1111 1111 1111',
          },
        ],
      },
      breadcrumbs: [
        {
          message: 'Call me at +1 (555) 123-4567',
          data: { address: '123 Main Street', ssn: '123-45-6789' },
        },
      ],
      extra: { email: 'jane@acme.com' },
      contexts: { user: { phone: '555-444-3333' } },
      user: { id: 'u123', email: 'user@site.com' },
    };

    const scrubbed = hook(event);
    expect(scrubbed).not.toBeNull();

    // Exception value scrubbed
    expect(scrubbed!.exception.values[0].value).not.toContain('@');
    expect(scrubbed!.exception.values[0].value).toContain('[EMAIL_REDACTED]');
    expect(scrubbed!.exception.values[0].value).toContain('[CARD_REDACTED]');

    // Breadcrumbs scrubbed
    expect(scrubbed!.breadcrumbs[0].message).toContain('[PHONE_REDACTED]');
    expect(scrubbed!.breadcrumbs[0].data.address).toBe('[ADDRESS_REDACTED]');
    expect(String(scrubbed!.breadcrumbs[0].data.ssn)).toContain(
      '[SSN_REDACTED]'
    );

    // Extra and contexts scrubbed recursively
    expect(String(scrubbed!.extra.email)).not.toContain('@');
    expect(String(scrubbed!.contexts.user.phone)).toContain('[PHONE_REDACTED]');

    // user.email removed when personalizedData is false; id is redacted
    expect(scrubbed!.user).toEqual({ id: '[USER_ID_REDACTED]' });
  });
});

describe('captureCategorizedErrorSync', () => {
  test('no-ops when crash reporting not consented', async () => {
    jest.doMock('@/lib/privacy-consent', () => ({
      getPrivacyConsentSync: jest.fn(() => ({
        analytics: false,
        crashReporting: false,
        personalizedData: false,
        sessionReplay: false,
        lastUpdated: Date.now(),
      })),
    }));

    jest.isolateModules(() => {
      // capture module references synchronously inside isolateModules
      // to ensure module cache isolation, but don't await async work here.
      // We'll flush microtasks and assert after isolateModules returns.
      const { captureCategorizedErrorSync: fn } =
        require('@/lib/sentry-utils') as typeof import('@/lib/sentry-utils');
      fn(new Error('boom'));
    });
    // wait microtask queue flush so any internal async work completes
    await Promise.resolve().then(() => {});
    // Now assert that Sentry.captureException was not called
    const Sentry = require('@sentry/react-native') as {
      captureException: jest.Mock;
    };
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});
