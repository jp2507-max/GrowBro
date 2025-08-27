import DeepLinkValidator from './deep-link-validator';

describe('DeepLinkValidator', () => {
  const v = new DeepLinkValidator();

  test('allows https same-origin', () => {
    expect(v.validateURL('https://growbro.app/post/123')).toBe(true);
  });

  test('allows growbro scheme', () => {
    expect(v.validateURL('growbro://post/123')).toBe(true);
  });

  test('rejects disallowed host', () => {
    expect(v.validateURL('https://evil.com/post/1')).toBe(false);
  });

  test('rejects userinfo', () => {
    expect(v.validateURL('https://user:pass@growbro.app/post/1')).toBe(false);
  });

  test('rejects unallowed port', () => {
    expect(v.validateURL('https://growbro.app:8080/post/1')).toBe(false);
  });

  test('rejects javascript: in redirect param (encoded)', () => {
    expect(
      v.validateURL('https://growbro.app/post/1?redirect=javascript%3Aalert(1)')
    ).toBe(false);
  });

  test('allows relative redirect', () => {
    expect(v.validateURL('https://growbro.app/post/1?redirect=/feed')).toBe(
      true
    );
  });

  test('rejects protocol-relative redirect', () => {
    expect(
      v.validateURL('https://growbro.app/post/1?redirect=//evil.com/')
    ).toBe(false);
  });

  test('sanitizeParams removes bad entries', () => {
    const out = v.sanitizeParams({
      id: 'abc_123',
      redirect: '/feed',
      bad: 'a b',
    });
    expect(out).toEqual({ id: 'abc_123' });
  });
});
