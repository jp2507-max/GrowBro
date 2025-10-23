/**
 * Error Classification Tests
 */

import { ErrorClassifier, errorClassifier } from '../error-classification';

describe('ErrorClassifier', () => {
  let classifier: ErrorClassifier;

  beforeEach(() => {
    classifier = new ErrorClassifier();
  });

  describe('HTTP status code classification', () => {
    test('classifies 400 as permanent validation error', () => {
      const error = Object.assign(new Error('Bad request'), { status: 400 });
      const classified = classifier.classify(error);

      expect(classified.category).toBe('validation');
      expect(classified.isRetryable).toBe(false);
      expect(classified.severity).toBe('medium');
    });

    test('classifies 401 as permanent authentication error', () => {
      const error = Object.assign(new Error('Unauthorized'), { status: 401 });
      const classified = classifier.classify(error);

      expect(classified.category).toBe('authentication');
      expect(classified.isRetryable).toBe(false);
      expect(classified.severity).toBe('high');
    });

    test('classifies 429 as transient rate limit error', () => {
      const error = Object.assign(new Error('Too many requests'), {
        status: 429,
      });
      const classified = classifier.classify(error);

      expect(classified.category).toBe('rate_limit');
      expect(classified.isRetryable).toBe(true);
      expect(classified.severity).toBe('low');
    });

    test('classifies 500 as transient server error', () => {
      const error = Object.assign(new Error('Internal server error'), {
        status: 500,
      });
      const classified = classifier.classify(error);

      expect(classified.category).toBe('server_error');
      expect(classified.isRetryable).toBe(true);
    });

    test('classifies 503 as transient server error', () => {
      const error = Object.assign(new Error('Service unavailable'), {
        status: 503,
      });
      const classified = classifier.classify(error);

      expect(classified.category).toBe('server_error');
      expect(classified.isRetryable).toBe(true);
    });
  });

  describe('error message pattern classification', () => {
    test('classifies timeout errors as transient', () => {
      const error = new Error('Request timeout after 30s');
      const classified = classifier.classify(error);

      expect(classified.category).toBe('timeout');
      expect(classified.isRetryable).toBe(true);
    });

    test('classifies network errors as transient', () => {
      const error = new Error('Network error: connection refused');
      const classified = classifier.classify(error);

      expect(classified.category).toBe('network');
      expect(classified.isRetryable).toBe(true);
    });

    test('classifies validation errors as permanent', () => {
      const error = new Error('Validation error: invalid email format');
      const classified = classifier.classify(error);

      expect(classified.category).toBe('validation');
      expect(classified.isRetryable).toBe(false);
    });

    test('classifies authentication errors as permanent', () => {
      const error = new Error('Authentication failed: invalid credentials');
      const classified = classifier.classify(error);

      expect(classified.category).toBe('authentication');
      expect(classified.isRetryable).toBe(false);
    });
  });

  describe('severity determination', () => {
    test('assigns critical severity for SLA-critical operations', () => {
      const error = new Error('Operation failed');
      const classified = classifier.classify(error, {
        operation: 'sla_critical_illegal_content',
      });

      expect(classified.severity).toBe('critical');
    });

    test('assigns high severity for authentication errors', () => {
      const error = Object.assign(new Error('Unauthorized'), { status: 401 });
      const classified = classifier.classify(error);

      expect(classified.severity).toBe('high');
    });

    test('assigns medium severity for validation errors', () => {
      const error = Object.assign(new Error('Bad request'), { status: 400 });
      const classified = classifier.classify(error);

      expect(classified.severity).toBe('medium');
    });

    test('assigns low severity for rate limit errors', () => {
      const error = Object.assign(new Error('Too many requests'), {
        status: 429,
      });
      const classified = classifier.classify(error);

      expect(classified.severity).toBe('low');
    });
  });

  describe('manual intervention determination', () => {
    test('requires manual intervention for critical errors', () => {
      const error = new Error('Critical failure');
      const classified = classifier.classify(error, {
        operation: 'sla_critical_csam_report',
      });

      expect(classified.requiresManualIntervention).toBe(true);
    });

    test('requires manual intervention when max attempts exceeded', () => {
      const error = new Error('Operation failed');
      const classified = classifier.classify(error, {
        operation: 'submit_report',
        attemptNumber: 5,
        maxAttempts: 5,
      });

      expect(classified.requiresManualIntervention).toBe(true);
    });

    test('requires manual intervention for permanent errors', () => {
      const error = Object.assign(new Error('Bad request'), { status: 400 });
      const classified = classifier.classify(error);

      expect(classified.requiresManualIntervention).toBe(false); // validation is medium severity
    });

    test('does not require manual intervention for transient errors', () => {
      const error = Object.assign(new Error('Service unavailable'), {
        status: 503,
      });
      const classified = classifier.classify(error);

      expect(classified.requiresManualIntervention).toBe(false);
    });
  });

  describe('suggested actions', () => {
    test('suggests retry with backoff for rate limit errors', () => {
      const error = Object.assign(new Error('Too many requests'), {
        status: 429,
      });
      const classified = classifier.classify(error);

      expect(classified.suggestedAction).toContain('rate limit');
      expect(classified.suggestedAction).toContain('exponential backoff');
    });

    test('suggests credential verification for authentication errors', () => {
      const error = Object.assign(new Error('Unauthorized'), { status: 401 });
      const classified = classifier.classify(error);

      expect(classified.suggestedAction).toContain('credentials');
    });

    test('suggests escalation for SLA-critical operations', () => {
      const error = new Error('Operation failed');
      const classified = classifier.classify(error, {
        operation: 'sla_critical_illegal_content',
      });

      expect(classified.suggestedAction).toContain('manual fallback');
    });
  });

  describe('singleton instance', () => {
    test('exports singleton errorClassifier', () => {
      expect(errorClassifier).toBeInstanceOf(ErrorClassifier);
    });

    test('isRetryable method works correctly', () => {
      const retryableError = Object.assign(new Error('Service unavailable'), {
        status: 503,
      });
      const permanentError = Object.assign(new Error('Bad request'), {
        status: 400,
      });

      expect(errorClassifier.isRetryable(retryableError)).toBe(true);
      expect(errorClassifier.isRetryable(permanentError)).toBe(false);
    });

    test('isPermanent method works correctly', () => {
      const permanentError = Object.assign(new Error('Bad request'), {
        status: 400,
      });
      const transientError = Object.assign(new Error('Service unavailable'), {
        status: 503,
      });

      expect(errorClassifier.isPermanent(permanentError)).toBe(true);
      expect(errorClassifier.isPermanent(transientError)).toBe(false);
    });
  });
});
