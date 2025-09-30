import type { ValidationReason } from './deep-link-validator';
import { DeepLinkValidator } from './deep-link-validator';

type Options = ConstructorParameters<typeof DeepLinkValidator>[0];

const BASE_ALLOWED_ORIGINS = [
  { host: 'trusted.example.com', ports: [443] },
  { host: 'internal.example.com', ports: [443, 8443] },
  { host: 'example.com', ports: [443] },
];

const BASE_ALLOWED_PATHS = [
  '/',
  '/dashboard',
  '/service',
  '/welcome',
  '/app',
  '/post/:id',
  '/settings',
];

const createValidator = (overrides?: Partial<Options>) =>
  new DeepLinkValidator({
    allowedOrigins: overrides?.allowedOrigins ?? BASE_ALLOWED_ORIGINS,
    allowedPathPatterns: overrides?.allowedPathPatterns ?? BASE_ALLOWED_PATHS,
    customScheme: overrides?.customScheme ?? 'growbro',
    navParamKeys: overrides?.navParamKeys ?? [
      'redirect',
      'next',
      'url',
      'continue',
    ],
    maxParamLength: overrides?.maxParamLength ?? 2048,
    maxPathLength: overrides?.maxPathLength ?? 2048,
    maxDecodeIterations: overrides?.maxDecodeIterations ?? 5,
  });

const expectFailure = (
  result: ReturnType<DeepLinkValidator['validateURLWithReason']>,
  reason: ValidationReason
) => {
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.reason).toBe(reason);
  }
};

type MatrixCase = {
  name: string;
  buildInput: () => string;
  options?: Partial<Options>;
  expected: { ok: true } | { ok: false; reason: ValidationReason };
};

const SANITIZER_PAYLOAD = '%25'.repeat(200) + '2e2e';

/**
 * Error precedence ordering (documented for test validation):
 * 1. scheme (forbidden-scheme-*)
 * 2. userinfo (forbidden-userinfo)
 * 3. insecure (blocked-redirect-insecure-http)
 * 4. nondefault-port (blocked-nondefault-port)
 * 5. idn (blocked-idn)
 * 6. path-traversal (blocked-path-traversal)
 * 7. sanitizer-iteration-limit
 */

const MATRIX: MatrixCase[] = [
  // 1. Forbidden scheme tests
  {
    name: 'rejects file: scheme for primary URL',
    buildInput: () => 'file:///etc/passwd',
    expected: { ok: false, reason: 'forbidden-scheme-file' },
  },
  {
    name: 'rejects nested file: inside parameter (percent-encoded)',
    buildInput: () => 'growbro://open?redirect=file%3A%2F%2F%2Fetc%2Fpasswd',
    expected: { ok: false, reason: 'forbidden-scheme-file' },
  },
  {
    name: 'rejects javascript: scheme in primary URL',
    buildInput: () => 'javascript:alert(1)',
    expected: { ok: false, reason: 'forbidden-scheme-javascript' },
  },
  {
    name: 'rejects nested javascript: in redirect parameter',
    buildInput: () => 'growbro://open?redirect=javascript%3Aalert%281%29',
    expected: { ok: false, reason: 'forbidden-scheme-javascript' },
  },
  {
    name: 'rejects intent: scheme in primary URL',
    buildInput: () => 'intent://scan/#Intent;scheme=zxing;end',
    expected: { ok: false, reason: 'forbidden-scheme-intent' },
  },
  {
    name: 'rejects nested intent: in redirect parameter',
    buildInput: () => 'growbro://open?redirect=intent%3A%2F%2Fscan%2F',
    expected: { ok: false, reason: 'forbidden-scheme-intent' },
  },
  {
    name: 'rejects data: scheme in primary URL',
    buildInput: () => 'data:text/html,<script>alert(1)</script>',
    expected: { ok: false, reason: 'forbidden-scheme-data' },
  },
  {
    name: 'rejects nested data: in redirect parameter',
    buildInput: () =>
      'growbro://open?redirect=data%3Atext%2Fhtml%2C%3Cscript%3E',
    expected: { ok: false, reason: 'forbidden-scheme-data' },
  },

  // 2. Insecure HTTP tests
  {
    name: 'rejects insecure http scheme even when host allowlisted',
    buildInput: () => 'http://insecure.example.com/welcome',
    options: {
      allowedOrigins: [{ host: 'insecure.example.com', ports: [443] }],
    },
    expected: { ok: false, reason: 'blocked-redirect-insecure-http' },
  },
  {
    name: 'rejects http external redirect when not allowlisted',
    buildInput: () =>
      'growbro://open?redirect=http%3A%2F%2Fevil.example.com%2Fpath',
    options: {
      allowedPathPatterns: ['/open'],
    },
    expected: { ok: false, reason: 'blocked-redirect-insecure-http' },
  },

  // 3. Userinfo tests
  {
    name: 'rejects userinfo in authority',
    buildInput: () => 'https://admin:password@evil.example.com/dashboard',
    options: {
      allowedOrigins: [{ host: 'evil.example.com', ports: [443] }],
    },
    expected: { ok: false, reason: 'forbidden-userinfo' },
  },
  {
    name: 'rejects main URL that includes userinfo in host',
    buildInput: () => 'https://alice:secret@trusted.example.com/welcome',
    options: {
      allowedOrigins: [{ host: 'trusted.example.com', ports: [443] }],
    },
    expected: { ok: false, reason: 'forbidden-userinfo' },
  },
  {
    name: 'rejects userinfo in nested redirect parameter',
    buildInput: () =>
      'growbro://open?redirect=https%3A%2F%2Fuser%3Apass%40evil.com%2F',
    options: {
      allowedPathPatterns: ['/open'],
    },
    expected: { ok: false, reason: 'forbidden-userinfo' },
  },

  // 4. Non-default port tests
  {
    name: 'rejects non-allowlisted port on otherwise valid origin',
    buildInput: () => 'https://example.com:8080/app',
    options: { allowedOrigins: [{ host: 'example.com', ports: [443] }] },
    expected: { ok: false, reason: 'blocked-nondefault-port' },
  },
  {
    name: 'rejects absolute URL with non-default (disallowed) port in redirect',
    buildInput: () =>
      'growbro://open?redirect=https%3A%2F%2Fapp.example.com%3A4443%2Fprofile',
    options: {
      allowedOrigins: [{ host: 'app.example.com', ports: [443] }],
      allowedPathPatterns: ['/open'],
    },
    expected: { ok: false, reason: 'blocked-nondefault-port' },
  },

  // 5. IDN tests
  {
    name: 'rejects IDN host that is not explicitly allowlisted',
    buildInput: () => 'https://xn--pple-43d.com/',
    expected: { ok: false, reason: 'blocked-idn' },
  },
  {
    name: 'rejects IDN in redirect parameter when not allowlisted',
    buildInput: () =>
      'growbro://open?redirect=https%3A%2F%2Fxn--xample-9ua.com%2Fprofile',
    options: {
      allowedPathPatterns: ['/open'],
    },
    expected: { ok: false, reason: 'blocked-idn' },
  },

  // 6. Path traversal tests
  {
    name: 'rejects percent-encoded path traversal attempts',
    buildInput: () => 'https://example.com/%252e%252e/%2e%2e/etc/secret',
    options: { allowedOrigins: [{ host: 'example.com', ports: [443] }] },
    expected: { ok: false, reason: 'blocked-path-traversal' },
  },
  {
    name: 'rejects nested/repeated encoding combined with path-traversal',
    buildInput: () =>
      'growbro://open?redirect=%252Fadmin%252F..%252Fuser%252Fprofile',
    options: {
      allowedPathPatterns: ['/open', '/admin'],
    },
    expected: { ok: false, reason: 'blocked-path-traversal' },
  },
  {
    name: 'rejects path that escapes allowed base after normalization',
    buildInput: () => 'https://example.com/dashboard/../../etc/passwd',
    options: {
      allowedOrigins: [{ host: 'example.com', ports: [443] }],
      allowedPathPatterns: ['/dashboard'],
    },
    expected: { ok: false, reason: 'blocked-path-traversal' },
  },

  // 7. Combined edge cases (precedence testing)
  {
    name: 'combined edge case prioritizes insecure scheme failure',
    buildInput: () =>
      'http://admin:bad@xn--pple-43d.com:8080/%252e%252e/%2e%2e/secret',
    expected: { ok: false, reason: 'blocked-redirect-insecure-http' },
  },
  {
    name: 'complex nested case — percent-encoded URL with forbidden scheme',
    buildInput: () =>
      'growbro://open?redirect=https%3A%2F%2Fxn--evil-abc.com%2F%3Fq%3Djavascript%253Aalert(1)',
    expected: { ok: false, reason: 'forbidden-scheme-javascript' },
  },

  // 8. Sanitizer iteration limit tests
  {
    name: 'bounds decoding and reports sanitizer iteration limit',
    buildInput: () =>
      `https://example.com/post/1?redirect=${SANITIZER_PAYLOAD}`,
    options: { allowedOrigins: [{ host: 'example.com', ports: [443] }] },
    expected: { ok: false, reason: 'sanitizer-iteration-limit' },
  },
  {
    name: 'repeated-encoding DoS defense (iteration cap)',
    buildInput: () =>
      `growbro://open?redirect=${encodeURIComponent('%25%25%25%25%25%252Fsecret')}`,
    expected: { ok: false, reason: 'sanitizer-iteration-limit' },
  },

  // 9. Allowlist positive tests
  {
    name: 'allows explicitly allowlisted host with default port',
    buildInput: () => 'https://trusted.example.com/dashboard',
    options: {
      allowedOrigins: [{ host: 'trusted.example.com', ports: [443] }],
    },
    expected: { ok: true },
  },
  {
    name: 'allows same-origin absolute redirect when origin matches allowlist',
    buildInput: () =>
      'growbro://open?redirect=https%3A%2F%2Fapp.example.com%3A443%2Fprofile',
    options: {
      allowedOrigins: [{ host: 'app.example.com', ports: [443] }],
      allowedPathPatterns: ['/open', '/profile'],
    },
    expected: { ok: true },
  },
  {
    name: 'allows relative redirect that normalizes safely',
    buildInput: () => 'growbro://open?redirect=%2Fprofile%2F..%2Fsettings%2F',
    options: {
      allowedPathPatterns: ['/open', '/settings'],
    },
    expected: { ok: true },
  },

  // 10. Non-default port allowlist tests
  {
    name: 'allows explicitly allowlisted non-default port',
    buildInput: () => 'https://internal.example.com:8443/service',
    options: {
      allowedOrigins: [{ host: 'internal.example.com', ports: [8443] }],
    },
    expected: { ok: true },
  },
  {
    name: 'allows IDN punycode when explicitly allowlisted',
    buildInput: () => 'https://xn--xample-9ua.com/dashboard',
    options: {
      allowedOrigins: [{ host: 'xn--xample-9ua.com', ports: [443] }],
      allowedPathPatterns: ['/dashboard'],
    },
    expected: { ok: true },
  },
];

describe('DeepLinkValidator security edge-case matrix', () => {
  test.each(MATRIX)('%s', ({ buildInput, expected, options }) => {
    const validator = createValidator(options);
    const result = validator.validateURLWithReason(buildInput());

    if (expected.ok) {
      expect(result).toEqual({ ok: true });
    } else {
      expectFailure(result, expected.reason);
    }
  });

  test('sanitizeParams filters navigation keys and invalid characters', () => {
    const validator = createValidator();
    const sanitized = validator.sanitizeParams({
      id: 'abc_123',
      redirect: '/feed',
      bad: 'a\x00b', // null byte should be rejected
      good: 'a b', // spaces should be allowed
      email: 'user@example.com', // emails should be allowed
      encoded: 'hello%20world', // percent-encoded should be allowed
    });

    expect(sanitized).toEqual({
      id: 'abc_123',
      good: 'a b',
      email: 'user@example.com',
      encoded: 'hello world', // should be decoded
    });
  });
});
