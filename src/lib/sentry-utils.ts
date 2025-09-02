import { getPrivacyConsent } from './privacy-consent';

/**
 * Regex patterns for detecting sensitive information
 */
const SENSITIVE_PATTERNS = {
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gi,
  phone: /(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g,
  // Common address patterns - street numbers and names
  address:
    /\b\d+\s+[A-Za-z0-9\s,.-]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Court|Ct|Place|Pl|Way|Circle|Cir)\b/gi,
  // Credit card numbers (basic pattern)
  creditCard: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
  // Social Security Numbers
  ssn: /\b\d{3}-?\d{2}-?\d{4}\b/g,
};

/**
 * Scrubs sensitive information from a string
 */
function scrubSensitiveData(text: string): string {
  let scrubbedText = text;

  // Replace emails
  scrubbedText = scrubbedText.replace(
    SENSITIVE_PATTERNS.email,
    '[EMAIL_REDACTED]'
  );

  // Replace phone numbers
  scrubbedText = scrubbedText.replace(
    SENSITIVE_PATTERNS.phone,
    '[PHONE_REDACTED]'
  );

  // Replace addresses
  scrubbedText = scrubbedText.replace(
    SENSITIVE_PATTERNS.address,
    '[ADDRESS_REDACTED]'
  );

  // Replace credit card numbers
  scrubbedText = scrubbedText.replace(
    SENSITIVE_PATTERNS.creditCard,
    '[CARD_REDACTED]'
  );

  // Replace SSNs
  scrubbedText = scrubbedText.replace(SENSITIVE_PATTERNS.ssn, '[SSN_REDACTED]');

  return scrubbedText;
}

/**
 * Recursively scrubs sensitive data from objects
 */
function scrubObjectData(
  obj: any,
  options?: {
    currentDepth?: number;
    visited?: WeakSet<object>;
    maxDepth?: number;
  }
): any {
  const DEFAULT_MAX_DEPTH = 6;
  const currentDepth = options?.currentDepth ?? 0;
  const visited = options?.visited ?? new WeakSet<object>();
  const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH;

  return _scrubObjectData(obj, { currentDepth, visited, maxDepth });
}

function _scrubObjectData(
  obj: any,
  ctx: { currentDepth: number; visited: WeakSet<object>; maxDepth: number }
): any {
  const { currentDepth, visited, maxDepth } = ctx;
  if (typeof obj === 'string') return scrubSensitiveData(obj);
  if (
    obj === null ||
    obj === undefined ||
    typeof obj === 'number' ||
    typeof obj === 'boolean' ||
    typeof obj === 'bigint' ||
    typeof obj === 'symbol' ||
    typeof obj === 'function'
  )
    return obj;
  if (currentDepth >= maxDepth) return '[MaxDepth]';
  if (visited.has(obj)) return '[Circular]';
  visited.add(obj);

  if (Array.isArray(obj)) {
    return obj.map((item) =>
      _scrubObjectData(item, {
        currentDepth: currentDepth + 1,
        visited,
        maxDepth,
      })
    );
  }
  if (obj instanceof Date) return obj.toISOString();
  if (obj instanceof RegExp) return obj.toString();

  if (obj instanceof Map) {
    const result: any = {};
    for (const [k, v] of obj.entries()) {
      try {
        result[String(k)] = _scrubObjectData(v, {
          currentDepth: currentDepth + 1,
          visited,
          maxDepth,
        });
      } catch {
        result[String(k)] = '[Unserializable]';
      }
    }
    return result;
  }
  if (obj instanceof Set) {
    return Array.from(obj).map((v) =>
      _scrubObjectData(v, {
        currentDepth: currentDepth + 1,
        visited,
        maxDepth,
      })
    );
  }
  if (obj && typeof obj === 'object') {
    const scrubbed: any = {};
    for (const [key, value] of Object.entries(obj)) {
      scrubbed[key] = _scrubObjectData(value, {
        currentDepth: currentDepth + 1,
        visited,
        maxDepth,
      });
    }
    return scrubbed;
  }
  return obj;
}

/**
 * Sentry beforeSend hook to scrub sensitive information and respect user consent
 */
export const beforeSendHook = (event: any, _hint?: any): any | null => {
  try {
    // Check user consent
    const consent = getPrivacyConsent();

    // If user hasn't consented to crash reporting, don't send the event
    if (!consent.crashReporting) {
      return null;
    }

    // If user hasn't consented to personalized data, remove user info
    if (!consent.personalizedData && event.user) {
      event.user = {
        id: event.user.id ? '[USER_ID_REDACTED]' : undefined,
      };
    }

    // Always scrub sensitive information regardless of consent
    // Scrub exception messages
    if (event.exception?.values) {
      event.exception.values = event.exception.values.map((exception: any) => ({
        ...exception,
        value: exception.value
          ? scrubSensitiveData(exception.value)
          : exception.value,
      }));
    }

    // Scrub breadcrumbs
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map((breadcrumb: any) => ({
        ...breadcrumb,
        message: breadcrumb.message
          ? scrubSensitiveData(breadcrumb.message)
          : breadcrumb.message,
        data: breadcrumb.data
          ? scrubObjectData(breadcrumb.data)
          : breadcrumb.data,
      }));
    }

    // Scrub extra data
    if (event.extra) {
      event.extra = scrubObjectData(event.extra);
    }

    // Scrub contexts
    if (event.contexts) {
      event.contexts = scrubObjectData(event.contexts);
    }

    // Always redact email addresses from user data
    if (event.user?.email) {
      event.user.email = '[EMAIL_REDACTED]';
    }

    return event;
  } catch {
    // If scrubbing fails, log the error and drop the event to avoid leaking PII
    // We return null to signal Sentry to discard the event.
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Sentry scrubber failed; dropping event.');
    }
    return null;
  }
};

/**
 * Captures an error to Sentry with categorization metadata.
 *
 * This function provides enhanced error reporting by:
 * 1. Categorizing errors using the error-handling utility
 * 2. Adding structured tags for better filtering and analysis
 * 3. Including categorized error messages as extra context
 *
 * Uses dynamic imports to avoid loading Sentry modules unless needed,
 * preventing unnecessary bundle bloat and initialization overhead.
 *
 * @param error - The error to capture (can be any type)
 *
 * Note: This function is intentionally async to handle dynamic imports gracefully.
 * If synchronous behavior is needed, consider using a fire-and-forget approach
 * with privacy consent checking as suggested by CodeRabbit AI.
 */
export async function captureCategorizedError(error: unknown): Promise<void> {
  try {
    // Dynamic imports to avoid requiring modules at bundle time
    // This prevents Sentry from being initialized unless actually used
    const [{ default: Sentry }, { categorizeError }] = await Promise.all([
      import('@sentry/react-native'),
      import('@/lib/error-handling'),
    ]);

    // Categorize the error for better context and filtering
    const cat = categorizeError(error);

    // Capture with enhanced metadata for better debugging
    Sentry.captureException(error, {
      tags: {
        category: cat.category,
        retryable: String(cat.isRetryable),
        status: cat.statusCode ? String(cat.statusCode) : undefined,
      },
      extra: { categorizedMessage: cat.message },
    });
  } catch {
    // Silently fail if imports or categorization fails
    // This prevents error reporting failures from breaking the app
  }
}

/**
 * Alternative synchronous version with privacy consent checking.
 *
 * This version addresses CodeRabbit AI's suggestion by:
 * 1. Making the function synchronous (fire-and-forget)
 * 2. Adding privacy consent validation before sending data
 * 3. Using dynamic imports to avoid bundle bloat
 * 4. Providing better error handling with development warnings
 *
 * @param error - The error to capture (can be any type)
 */
export function captureCategorizedErrorSync(error: unknown): void {
  // Respect user consent before doing any work
  const { hasConsent } = require('@/lib/privacy-consent');
  if (!hasConsent('crashReporting')) {
    return;
  }

  // Lazy-load modules; do not block the caller
  void Promise.all([
    import('@sentry/react-native'),
    import('@/lib/error-handling'),
  ])
    .then(([{ default: Sentry }, { categorizeError }]) => {
      const cat = categorizeError(error);
      Sentry.captureException(error, {
        tags: {
          category: cat.category,
          retryable: String(cat.isRetryable),
          status: cat.statusCode ? String(cat.statusCode) : undefined,
        },
        extra: { categorizedMessage: cat.message },
      });
    })
    .catch(() => {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          'captureCategorizedErrorSync suppressed (module load failed).'
        );
      }
    });
}
