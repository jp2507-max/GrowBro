import {
  clearPendingDeepLink,
  consumePendingDeepLink,
  isProtectedDeepLinkPath,
  peekPendingDeepLink,
  stashPendingDeepLink,
} from './deep-link-gate';

describe('deep-link gate store', () => {
  afterEach(() => {
    clearPendingDeepLink();
  });

  test('stashes and consumes pending path', () => {
    stashPendingDeepLink('/post/123');
    expect(peekPendingDeepLink()).toBe('/post/123');
    expect(consumePendingDeepLink()).toBe('/post/123');
    expect(peekPendingDeepLink()).toBeNull();
  });

  test('normalizes relative path before storing', () => {
    stashPendingDeepLink('post/456');
    expect(peekPendingDeepLink()).toBe('/post/456');
  });

  test('clears pending path', () => {
    stashPendingDeepLink('/calendar');
    clearPendingDeepLink();
    expect(peekPendingDeepLink()).toBeNull();
  });
});

describe('isProtectedDeepLinkPath', () => {
  test('treats explicit public routes as unprotected', () => {
    expect(isProtectedDeepLinkPath('/login')).toBe(false);
    expect(isProtectedDeepLinkPath('/onboarding')).toBe(false);
  });

  test('marks known prefixes as public', () => {
    expect(isProtectedDeepLinkPath('/legal/terms')).toBe(false);
    expect(isProtectedDeepLinkPath('/privacy/policy')).toBe(false);
  });

  test('defaults to protected for app content', () => {
    expect(isProtectedDeepLinkPath('/post/1')).toBe(true);
    expect(isProtectedDeepLinkPath('/')).toBe(true);
  });
});
