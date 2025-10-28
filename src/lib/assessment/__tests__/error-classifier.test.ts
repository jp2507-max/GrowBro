import { classifyError, shouldFallbackToCloud } from '../error-classifier';

describe('classifyError', () => {
  describe('network errors', () => {
    test('classifies network timeout errors', () => {
      const error = new Error('Network request timeout');
      const classification = classifyError(error);

      expect(classification.category).toBe('network');
      expect(classification.isTransient).toBe(true);
      expect(classification.shouldRetry).toBe(true);
      expect(classification.fallbackToCloud).toBe(false);
    });

    test('classifies connection refused errors', () => {
      const error = { code: 'ECONNREFUSED', message: 'Connection refused' };
      const classification = classifyError(error);

      expect(classification.category).toBe('network');
      expect(classification.isTransient).toBe(true);
      expect(classification.shouldRetry).toBe(true);
    });

    test('classifies offline errors', () => {
      const error = new Error('No internet connection');
      const classification = classifyError(error);

      expect(classification.category).toBe('network');
      expect(classification.isTransient).toBe(true);
    });
  });

  describe('authentication errors', () => {
    test('classifies 401 unauthorized errors', () => {
      const error = { code: '401', message: 'Unauthorized' };
      const classification = classifyError(error);

      expect(classification.category).toBe('auth');
      expect(classification.isTransient).toBe(true);
      expect(classification.shouldRetry).toBe(true);
    });

    test('classifies token expired errors', () => {
      const error = new Error('JWT token expired');
      const classification = classifyError(error);

      expect(classification.category).toBe('auth');
      expect(classification.isTransient).toBe(true);
    });
  });

  describe('validation errors', () => {
    test('classifies 400 bad request errors', () => {
      const error = { code: '400', message: 'Bad request' };
      const classification = classifyError(error);

      expect(classification.category).toBe('validation');
      expect(classification.isTransient).toBe(false);
      expect(classification.shouldRetry).toBe(false);
    });

    test('classifies validation errors', () => {
      const error = new Error('Validation failed: missing required field');
      const classification = classifyError(error);

      expect(classification.category).toBe('validation');
      expect(classification.isTransient).toBe(false);
      expect(classification.shouldRetry).toBe(false);
    });
  });

  describe('server errors', () => {
    test('classifies 5xx errors as transient', () => {
      const error = { code: '500', message: 'Internal server error' };
      const classification = classifyError(error);

      expect(classification.category).toBe('server');
      expect(classification.isTransient).toBe(true);
      expect(classification.shouldRetry).toBe(true);
    });

    test('classifies 503 service unavailable as transient', () => {
      const error = { code: '503', message: 'Service unavailable' };
      const classification = classifyError(error);

      expect(classification.category).toBe('server');
      expect(classification.isTransient).toBe(true);
      expect(classification.shouldRetry).toBe(true);
    });

    test('classifies 4xx errors as permanent', () => {
      const error = { code: '404', message: 'Not found' };
      const classification = classifyError(error);

      expect(classification.category).toBe('server');
      expect(classification.isTransient).toBe(false);
      expect(classification.shouldRetry).toBe(false);
    });
  });

  describe('quota errors', () => {
    test('classifies rate limit errors', () => {
      const error = { code: '429', message: 'Too many requests' };
      const classification = classifyError(error);

      expect(classification.category).toBe('quota');
      expect(classification.isTransient).toBe(true);
      expect(classification.shouldRetry).toBe(true);
    });

    test('classifies quota exceeded errors', () => {
      const error = new Error('Quota exceeded');
      const classification = classifyError(error);

      expect(classification.category).toBe('quota');
      expect(classification.isTransient).toBe(true);
    });
  });

  describe('unknown errors', () => {
    test('classifies unknown errors as transient', () => {
      const error = new Error('Something went wrong');
      const classification = classifyError(error);

      expect(classification.category).toBe('unknown');
      expect(classification.isTransient).toBe(true);
      expect(classification.shouldRetry).toBe(true);
    });

    test('handles string errors', () => {
      const error = 'Unknown error occurred';
      const classification = classifyError(error);

      expect(classification.category).toBe('unknown');
      expect(classification.isTransient).toBe(true);
    });
  });
});

describe('shouldFallbackToCloud', () => {
  test('returns true for out of memory errors', () => {
    const error = new Error('Out of memory');
    expect(shouldFallbackToCloud(error)).toBe(true);
  });

  test('returns true for model load failures', () => {
    const error = new Error('Model load failed');
    expect(shouldFallbackToCloud(error)).toBe(true);
  });

  test('returns true for inference timeout', () => {
    const error = new Error('Inference timeout exceeded');
    expect(shouldFallbackToCloud(error)).toBe(true);
  });

  test('returns true for device inference failures', () => {
    const error = new Error('Device inference failed');
    expect(shouldFallbackToCloud(error)).toBe(true);
  });

  test('returns false for network errors', () => {
    const error = new Error('Network timeout');
    expect(shouldFallbackToCloud(error)).toBe(false);
  });

  test('returns false for validation errors', () => {
    const error = new Error('Validation failed');
    expect(shouldFallbackToCloud(error)).toBe(false);
  });
});
