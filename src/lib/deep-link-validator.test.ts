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

const MATRIX: MatrixCase[] = [
  {
    name: 'rejects file: scheme for primary URL',
    buildInput: () => 'file:///etc/passwd',
    expected: { ok: false, reason: 'forbidden-scheme-file' },
  },
  {
    name: 'rejects insecure http scheme even when host allowlisted',
    buildInput: () => 'http://insecure.example.com/welcome',
    options: {
      allowedOrigins: [{ host: 'insecure.example.com', ports: [443] }],
    },
    expected: { ok: false, reason: 'blocked-redirect-insecure-http' },
  },
  {
    name: 'rejects userinfo in authority',
    buildInput: () => 'https://admin:password@evil.example.com/dashboard',
    options: {
      allowedOrigins: [{ host: 'evil.example.com', ports: [443] }],
    },
    expected: { ok: false, reason: 'forbidden-userinfo' },
  },
  {
    name: 'rejects non-allowlisted port on otherwise valid origin',
    buildInput: () => 'https://example.com:8080/app',
    options: { allowedOrigins: [{ host: 'example.com', ports: [443] }] },
    expected: { ok: false, reason: 'blocked-nondefault-port' },
  },
  {
    name: 'rejects IDN host that is not explicitly allowlisted',
    buildInput: () => 'https://xn--pple-43d.com/',
    expected: { ok: false, reason: 'blocked-idn' },
  },
  {
    name: 'rejects percent-encoded path traversal attempts',
    buildInput: () => 'https://example.com/%252e%252e/%2e%2e/etc/secret',
    options: { allowedOrigins: [{ host: 'example.com', ports: [443] }] },
    expected: { ok: false, reason: 'blocked-path-traversal' },
  },
  {
    name: 'combined edge case prioritizes insecure scheme failure',
    buildInput: () =>
      'http://admin:bad@xn--pple-43d.com:8080/%252e%252e/%2e%2e/secret',
    expected: { ok: false, reason: 'blocked-redirect-insecure-http' },
  },
  {
    name: 'bounds decoding and reports sanitizer iteration limit',
    buildInput: () =>
      `https://example.com/post/1?redirect=${SANITIZER_PAYLOAD}`,
    options: { allowedOrigins: [{ host: 'example.com', ports: [443] }] },
    expected: { ok: false, reason: 'sanitizer-iteration-limit' },
  },
  {
    name: 'allows explicitly allowlisted host with default port',
    buildInput: () => 'https://trusted.example.com/dashboard',
    options: {
      allowedOrigins: [{ host: 'trusted.example.com', ports: [443] }],
    },
    expected: { ok: true },
  },
  {
    name: 'allows explicitly allowlisted non-default port',
    buildInput: () => 'https://internal.example.com:8443/service',
    options: {
      allowedOrigins: [{ host: 'internal.example.com', ports: [8443] }],
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
