import { sanitizeObjectPII, sanitizeTextPII } from '@/lib/sentry-utils';
import { cleanup } from '@/lib/test-utils';

afterEach(cleanup);

describe('sentry-utils scrubObjectForSentry', () => {
  test('respects maxDepth for nested objects', () => {
    const obj: any = { a: { b: { c: { d: { e: 5 } } } } };
    const scrubbed = sanitizeObjectPII(obj, 2 as any);
    // Implementation returns '[MaxDepth]' when depth exceeded
    expect(scrubbed.a.b).toBe('[MaxDepth]');
  });

  test('handles circular references without throwing', () => {
    const obj: any = { a: 1 };
    obj.self = obj;
    const scrubbed = sanitizeObjectPII(obj as any);
    expect(scrubbed.a).toBe(1);
    // self should be replaced with a marker
    expect(scrubbed.self).toBe('[Circular]');
  });

  test('handles mixed-type arrays and nested structures', () => {
    const obj: any = {
      arr: [1, 'two', { three: 3 }, [4]],
    };
    const scrubbed = sanitizeObjectPII(obj as any);
    expect(scrubbed.arr[0]).toBe(1);
    expect(scrubbed.arr[1]).toBe('two');
    expect(scrubbed.arr[2].three).toBe(3);
    expect(Array.isArray(scrubbed.arr[3])).toBe(true);
    expect(scrubbed.arr[3][0]).toBe(4);
  });

  test('serializes Maps and Sets into arrays', () => {
    const map = new Map();
    map.set('k', 'v');
    const set = new Set([1, 2]);
    const obj = { map, set } as any;
    const scrubbed = sanitizeObjectPII(obj as any);
    // Maps are serialized into objects with string keys
    expect(scrubbed.map).toEqual({ k: 'v' });
    expect(scrubbed.set).toEqual([1, 2]);
  });

  test('scrubs axios-like objects (config, request, response)', () => {
    const axiosLike: any = {
      config: {
        url: 'https://example.com',
        headers: { Authorization: 'secret' },
      },
      request: { _header: 'raw header' },
      response: { status: 500, data: { message: 'oh no' } },
    };

    const scrubbed = sanitizeObjectPII(axiosLike as any);
    // ensure config is present and preserved
    expect(scrubbed.config.url).toBe('https://example.com');
    expect(scrubbed.config.headers).toBeDefined();
    expect(scrubbed.response.status).toBe(500);
    expect(scrubbed.request).toBeDefined();
  });
});

describe('sanitizeTextPII', () => {
  test('redacts emails from text', () => {
    const txt = 'reach me at test@example.com';
    expect(sanitizeTextPII(txt)).toContain('[EMAIL_REDACTED]');
  });
});

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
    // Mock modules needed for this test
    jest.doMock('@sentry/react-native', () => ({
      captureException: jest.fn(),
    }));

    jest.doMock('@/lib/privacy-consent', () => ({
      getPrivacyConsentSync: jest.fn(() => ({
        analytics: false,
        crashReporting: false,
        personalizedData: false,
        sessionReplay: false,
        lastUpdated: Date.now(),
      })),
    }));

    jest.doMock('@/lib/error-handling', () => ({
      categorizeError: (e: unknown) => ({
        category: 'test',
        isRetryable: false,
        statusCode: 0,
        message: String(e),
      }),
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
