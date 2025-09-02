import { categorizeError, shouldRetry } from '@/lib/error-handling';

function makeAxiosError(partial: any): any {
  return { isAxiosError: true, ...partial };
}

describe('error-handling', () => {
  test('categorizes network errors as retryable', () => {
    const err = makeAxiosError({
      request: {},
      response: undefined,
      message: 'Network Error',
    });
    const c = categorizeError(err);
    expect(c.category).toBe('network');
    expect(shouldRetry(err)).toBe(true);
  });

  test('categorizes 409 as conflict and not retryable', () => {
    const err = makeAxiosError({
      response: { status: 409 },
      message: 'conflict',
    });
    const c = categorizeError(err);
    expect(c.category).toBe('conflict');
    expect(shouldRetry(err)).toBe(false);
  });

  test('categorizes 5xx as network and retryable', () => {
    const err = makeAxiosError({
      response: { status: 503 },
      message: 'service unavailable',
    });
    const c = categorizeError(err);
    expect(c.category).toBe('network');
    expect(shouldRetry(err)).toBe(true);
  });

  test('categorizes 401/403 as permission and not retryable', () => {
    const err401 = makeAxiosError({
      response: { status: 401 },
      message: 'unauthorized',
    });
    const c401 = categorizeError(err401);
    expect(c401.category).toBe('permission');
    expect(shouldRetry(err401)).toBe(false);

    const err403 = makeAxiosError({
      response: { status: 403 },
      message: 'forbidden',
    });
    const c403 = categorizeError(err403);
    expect(c403.category).toBe('permission');
    expect(shouldRetry(err403)).toBe(false);
  });

  test('categorizes 429 as rate_limit and retryable', () => {
    const err = makeAxiosError({
      response: { status: 429 },
      message: 'too many requests',
    });
    const c = categorizeError(err);
    expect(c.category).toBe('rate_limit');
    expect(shouldRetry(err)).toBe(true);
  });
});
