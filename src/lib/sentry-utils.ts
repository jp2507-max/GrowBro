import { getPrivacyConsentSync } from './privacy-consent';

type ErrorContext = Record<string, unknown>;

/**
 * Regex patterns for detecting sensitive information
 */
const SENSITIVE_PATTERNS = {
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gi,
  phone: /(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g,
  // Common address patterns - street numbers and names
  address:
    /\b\d+\s+[A-Za-z0-9\s,.-]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Court|Ct|Place|Pl|Way|Circle|Cir|Terrace|Ter)\b/gi,
  // Credit card numbers (basic pattern)
  creditCard: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
  // Social Security Numbers
  ssn: /\b\d{3}-?\d{2}-?\d{4}\b/g,
  // API keys and tokens - various common patterns
  apiKey:
    /\b(?:sk|pk|api_key|x-api-key|x-rapidapi-key|bearer|token)[-_]?\w*[:=]\s*['"]?([a-zA-Z0-9_-]{20,})['"]?\b/gi,
  // RapidAPI keys (typically 50+ character alphanumeric strings)
  rapidApiKey: /\b[a-zA-Z0-9]{50,}\b/g,
  // Authorization headers with tokens
  authHeader:
    /\b(?:authorization|auth):\s*(?:bearer|basic)\s+[a-zA-Z0-9_.-]{20,}/gi,
  // Generic sensitive header values (long alphanumeric strings that could be keys)
  sensitiveHeader:
    /\b(?:x-rapidapi-key|x-rapidapi-host|x-api-key|api-key|apikey):\s*[a-zA-Z0-9_-]{20,}/gi,
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

  // Replace API keys and tokens
  scrubbedText = scrubbedText.replace(
    SENSITIVE_PATTERNS.apiKey,
    '[API_KEY_REDACTED]'
  );
  scrubbedText = scrubbedText.replace(
    SENSITIVE_PATTERNS.rapidApiKey,
    '[RAPIDAPI_KEY_REDACTED]'
  );
  scrubbedText = scrubbedText.replace(
    SENSITIVE_PATTERNS.authHeader,
    '[AUTH_HEADER_REDACTED]'
  );
  scrubbedText = scrubbedText.replace(
    SENSITIVE_PATTERNS.sensitiveHeader,
    '[SENSITIVE_HEADER_REDACTED]'
  );

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

function scrubPrimitives(obj: any, ctx: ScrubContext): any {
  if (typeof obj === 'string') return scrubSensitiveData(obj);
  if (
    obj === null ||
    obj === undefined ||
    typeof obj === 'number' ||
    typeof obj === 'boolean' ||
    typeof obj === 'bigint' ||
    typeof obj === 'symbol' ||
    typeof obj === 'function'
  ) {
    return obj;
  }
  if (ctx.currentDepth >= ctx.maxDepth) return '[MaxDepth]';
  if (ctx.visited.has(obj)) return '[Circular]';
  return null;
}

function scrubArrayAndBuiltins(obj: any, ctx: ScrubContext): any {
  if (Array.isArray(obj)) {
    return obj.map((item) =>
      _scrubObjectData(item, {
        currentDepth: ctx.currentDepth + 1,
        visited: ctx.visited,
        maxDepth: ctx.maxDepth,
      })
    );
  }
  if (obj instanceof Date) return obj.toISOString();
  if (obj instanceof RegExp) return obj.toString();
  return null;
}

function scrubMapAndSet(obj: any, ctx: ScrubContext): any {
  if (obj instanceof Map) {
    const result: any = {};
    for (const [k, v] of obj.entries()) {
      try {
        result[String(k)] = _scrubObjectData(v, {
          currentDepth: ctx.currentDepth + 1,
          visited: ctx.visited,
          maxDepth: ctx.maxDepth,
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
        currentDepth: ctx.currentDepth + 1,
        visited: ctx.visited,
        maxDepth: ctx.maxDepth,
      })
    );
  }
  return null;
}

function scrubAxiosObject(obj: any, ctx: ScrubContext): any {
  if (
    obj &&
    typeof obj === 'object' &&
    (obj.config || obj.request || obj.response)
  ) {
    const sanitized = { ...obj };
    const nextCtx = {
      currentDepth: ctx.currentDepth + 1,
      visited: ctx.visited,
      maxDepth: ctx.maxDepth,
    };

    if (sanitized.config && typeof sanitized.config === 'object') {
      sanitized.config = _scrubObjectData(sanitized.config, nextCtx);
    }
    if (sanitized.request && typeof sanitized.request === 'object') {
      sanitized.request = _scrubObjectData(sanitized.request, nextCtx);
    }
    if (sanitized.response && typeof sanitized.response === 'object') {
      sanitized.response = _scrubObjectData(sanitized.response, nextCtx);
    }
    return sanitized;
  }
  return null;
}

type ScrubContext = {
  currentDepth: number;
  visited: WeakSet<object>;
  maxDepth: number;
};

function _scrubObjectData(obj: any, ctx: ScrubContext): any {
  const primitiveResult = scrubPrimitives(obj, ctx);
  if (primitiveResult !== null || typeof primitiveResult !== 'object') {
    return primitiveResult;
  }

  ctx.visited.add(obj);

  const arrayResult = scrubArrayAndBuiltins(obj, ctx);
  if (arrayResult !== null) return arrayResult;

  const mapSetResult = scrubMapAndSet(obj, ctx);
  if (mapSetResult !== null) return mapSetResult;

  const axiosResult = scrubAxiosObject(obj, ctx);
  if (axiosResult !== null) return axiosResult;

  if (obj && typeof obj === 'object') {
    const scrubbed: any = {};
    for (const [key, value] of Object.entries(obj)) {
      scrubbed[key] = _scrubObjectData(value, {
        currentDepth: ctx.currentDepth + 1,
        visited: ctx.visited,
        maxDepth: ctx.maxDepth,
      });
    }
    return scrubbed;
  }
  return obj;
}

/**
 * Sentry beforeSend hook to scrub sensitive information and respect user consent
 */
/* eslint-disable max-lines-per-function -- function intentionally contains a series of small
  scrubbers and data transformations; splitting reduces readability for this hook. */
export const beforeSendHook = (event: any, _hint?: any): any | null => {
  try {
    // Check user consent using synchronous cache
    const consent = getPrivacyConsentSync();

    // If cache is not populated yet, fall back to default consent (crash reporting enabled)
    const effectiveConsent = consent || {
      analytics: false,
      crashReporting: true, // Default to enabled for crash reporting
      personalizedData: false,
      sessionReplay: false,
      lastUpdated: Date.now(),
    };

    // If user hasn't consented to crash reporting, don't send the event
    if (!effectiveConsent.crashReporting) {
      return null;
    }

    // If user hasn't consented to personalized data, remove user info
    if (!effectiveConsent.personalizedData && event.user) {
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
 * Public helper that sanitizes text for PII. Use for analytics/telemetry payloads as needed.
 * Intentionally lightweight and shared with the Sentry beforeSend hook implementation.
 */
export function sanitizeTextPII(text: string): string {
  try {
    return scrubSensitiveData(text);
  } catch {
    return text;
  }
}

/**
 * Public helper that sanitizes arbitrary JSON-serializable data for PII.
 * Limits depth and handles circulars; safe for analytics/telemetry payloads.
 */
export function sanitizeObjectPII<T = unknown>(value: T, maxDepth = 6): T {
  try {
    return scrubObjectData(value, { maxDepth }) as T;
  } catch {
    return value;
  }
}

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
export async function captureCategorizedError(
  error: unknown,
  context?: ErrorContext
): Promise<void> {
  try {
    // Dynamic imports to avoid requiring modules at bundle time
    // This prevents Sentry from being initialized unless actually used
    const [sentryMod, errorMod] = await Promise.all([
      import('@sentry/react-native'),
      import('@/lib/error-handling'),
    ]);

    // Normalize exports to handle both default and namespace shapes
    const SentryClient = sentryMod.default ?? sentryMod;
    const { categorizeError } = errorMod;

    // Categorize the error for better context and filtering
    const cat = categorizeError(error);

    // Capture with enhanced metadata for better debugging
    const sanitizedContext = context ? sanitizeObjectPII(context) : {};

    SentryClient.captureException(error, {
      tags: {
        category: cat.category,
        retryable: String(cat.isRetryable),
        status: cat.statusCode ? String(cat.statusCode) : undefined,
      },
      extra: {
        categorizedMessage: cat.message,
        ...sanitizedContext,
      },
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
export function captureCategorizedErrorSync(
  error: unknown,
  context?: ErrorContext
): void {
  // Respect user consent before doing any work using synchronous cache
  const consent = getPrivacyConsentSync();

  // If cache is not populated yet, fall back to default consent (crash reporting enabled)
  const effectiveConsent = consent || {
    analytics: false,
    crashReporting: true, // Default to enabled for crash reporting
    personalizedData: false,
    sessionReplay: false,
    lastUpdated: Date.now(),
  };

  if (!effectiveConsent.crashReporting) {
    return;
  }

  // Lazy-load modules; do not block the caller
  const sanitizedContext = context ? sanitizeObjectPII(context) : {};

  void Promise.all([
    import('@sentry/react-native'),
    import('@/lib/error-handling'),
  ])
    .then(([sentryMod, errorMod]) => {
      // Normalize exports to handle both default and namespace shapes
      const SentryClient = sentryMod.default ?? sentryMod;
      const { categorizeError } = errorMod;
      const cat = categorizeError(error);
      SentryClient.captureException(error, {
        tags: {
          category: cat.category,
          retryable: String(cat.isRetryable),
          status: cat.statusCode ? String(cat.statusCode) : undefined,
        },
        extra: {
          categorizedMessage: cat.message,
          ...sanitizedContext,
        },
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
