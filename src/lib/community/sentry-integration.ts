/**
 * Sentry integration utilities for community feed
 *
 * Provides privacy-safe error tracking and performance monitoring
 * for community operations.
 *
 * Requirement 10.6: Error events with lightweight, privacy-safe context
 */

/**
 * Capture a community-related error with sanitized context
 *
 * @param error - The error to capture
 * @param operation - The operation that failed (e.g., 'like', 'comment', 'delete')
 * @param context - Additional context (will be sanitized)
 */
export async function captureCommunityError(
  error: unknown,
  operation: string,
  context?: Record<string, unknown>
): Promise<void> {
  try {
    const Sentry = await import('@sentry/react-native');

    Sentry.captureException(error, {
      tags: {
        category: 'community',
        operation,
      },
      extra: sanitizeContext(context),
    });
  } catch (err) {
    console.warn('[CommunitySentry] Failed to capture error:', err);
  }
}

/**
 * Add a breadcrumb for community state transitions
 *
 * @param message - Human-readable message
 * @param data - Additional data (will be sanitized)
 */
export async function addCommunityBreadcrumb(
  message: string,
  data?: Record<string, unknown>
): Promise<void> {
  try {
    const Sentry = await import('@sentry/react-native');

    Sentry.addBreadcrumb({
      category: 'community',
      message,
      level: 'info',
      data: sanitizeContext(data),
    });
  } catch (err) {
    console.warn('[CommunitySentry] Failed to add breadcrumb:', err);
  }
}

/**
 * Track a community performance transaction
 *
 * @param name - Transaction name
 * @param operation - Operation type
 * @param fn - Function to execute and measure
 * @returns Result of the function
 */
export async function trackCommunityTransaction<T>(
  name: string,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  try {
    const Sentry = await import('@sentry/react-native');

    // Use Sentry.startSpan for modern API (v4+)
    return await Sentry.startSpan(
      {
        name: `community.${name}`,
        op: operation,
        attributes: {
          category: 'community',
        },
      },
      async () => {
        return await fn();
      }
    );
  } catch (err) {
    // If Sentry fails, still execute the function
    console.warn('[CommunitySentry] Failed to track transaction:', err);
    return fn();
  }
}

/**
 * Sanitize context to remove PII and sensitive data
 * Requirement 10.6: Privacy-safe context
 */
function sanitizeContext(
  context?: Record<string, unknown>
): Record<string, unknown> {
  if (!context) return {};

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(context)) {
    // Skip sensitive fields
    if (
      key.toLowerCase().includes('user_id') ||
      key.toLowerCase().includes('email') ||
      key.toLowerCase().includes('username') ||
      key.toLowerCase().includes('auth') ||
      key.toLowerCase().includes('token')
    ) {
      sanitized[key] = '[REDACTED]';
      continue;
    }

    // Keep primitive types and shallow objects
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      sanitized[key] = value;
    } else if (value === null || value === undefined) {
      sanitized[key] = value;
    } else if (typeof value === 'object') {
      // For objects, only keep primitive fields
      const obj = value as Record<string, unknown>;
      sanitized[key] = Object.fromEntries(
        Object.entries(obj)
          .filter(([_, v]) => typeof v !== 'object')
          .map(([k, v]) => [k, v])
      );
    }
  }

  return sanitized;
}
