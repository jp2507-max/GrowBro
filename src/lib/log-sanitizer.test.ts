import { LogSanitizer } from './log-sanitizer';

describe('LogSanitizer', () => {
  const sanitizer = new LogSanitizer({});

  test('redacts mixed-case email addresses', () => {
    const input = 'Contact SUPPORT@Example.COM for help';
    const out = sanitizer.sanitizeLog(input);
    expect(out).toBe('Contact [REDACTED] for help');
  });

  test("doesn't over-redact keys like 'monkey' but redacts 'api-key'", () => {
    const obj = {
      monkey: 'value',
      // test-only fake value so secret scanners don't flag this file.
      // This is intentionally NOT a real key: "TEST_API_KEY_FAKE_DO_NOT_USE"
      // gitleaks:allow (test) or scanner-ignore: reason=test-only
      'api-key': 'TEST_API_KEY_FAKE_DO_NOT_USE',
      nested: { myKey: 'keep' },
    } as any;

    const sanitized = sanitizer.sanitizeObject(obj) as any;
    expect(sanitized.monkey).toBe('value');
    // api-key should be redacted because token 'key' is sensitive
    expect(sanitized['api-key']).toBe('[REDACTED]');
    // myKey splits to ['mykey'] -> no match
    expect(sanitized.nested.myKey).toBe('keep');
  });

  test('preserves Date objects', () => {
    const d = new Date('2020-01-01T00:00:00.000Z');
    const obj = { created: d };
    const sanitized = sanitizer.sanitizeObject(obj) as any;
    expect(sanitized.created).toBeInstanceOf(Date);
    expect(sanitized.created.toISOString()).toBe(d.toISOString());
  });

  test('handles circular structures without throwing', () => {
    const a: any = { name: 'a' };
    const b: any = { name: 'b', ref: a };
    a.ref = b;

    const sanitized = sanitizer.sanitizeObject(a) as any;
    expect(sanitized.name).toBe('a');
    // Circular references are replaced with '[Circular]'
    expect(sanitized.ref).toBeDefined();
  });

  test('preserves Map, Set, and BigInt entries', () => {
    const map = new Map();
    map.set('k', 'v');
    const set = new Set([1, 2, 3]);
    const obj: any = { map, set, big: BigInt(123) };
    const sanitized = sanitizer.sanitizeObject(obj) as any;
    expect(sanitized.map instanceof Map).toBe(true);
    expect(sanitized.map.get('k')).toBe('v');
    expect(sanitized.set instanceof Set).toBe(true);
    expect([...sanitized.set]).toEqual([1, 2, 3]);
    expect(typeof sanitized.big).toBe('bigint');
  });
});
