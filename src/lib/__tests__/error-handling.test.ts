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
});
