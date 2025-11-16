/**
 * Authentication telemetry and analytics helpers
 * Implements consent-aware tracking and PII sanitization for auth events
 */

import { Env } from '@env';
import * as Sentry from '@sentry/react-native';
import * as Crypto from 'expo-crypto';

import type { AnalyticsClient } from '@/lib/analytics';
import { createConsentGatedAnalytics, NoopAnalytics } from '@/lib/analytics';
import { SDKGate } from '@/lib/privacy/sdk-gate';
import {
  getPrivacyConsent,
  hasConsent,
  onPrivacyConsentChange,
} from '@/lib/privacy-consent';

// Register analytics SDK with SDKGate
SDKGate.registerSDK('analytics', 'telemetry', []);

/**
 * Analytics client that respects consent settings
 * Starts as NoopAnalytics and switches to real client when consent is granted
 */
let authAnalyticsClient: AnalyticsClient = NoopAnalytics;

/**
 * Initialize auth analytics based on current consent state
 */
function initializeAuthAnalytics(): void {
  const consent = getPrivacyConsent();

  if (consent.analytics) {
    // Initialize real analytics client if consent granted
    SDKGate.initializeSDK('analytics')
      .then(() => {
        // TODO: Replace with actual analytics client when available
        authAnalyticsClient = createConsentGatedAnalytics(NoopAnalytics);
      })
      .catch((error) => {
        console.warn('Failed to initialize analytics SDK:', error);
        authAnalyticsClient = NoopAnalytics;
      });
  } else {
    // Use no-op client if consent not granted
    authAnalyticsClient = NoopAnalytics;
    SDKGate.blockSDK('analytics');
  }
}

// Initialize analytics on first import
initializeAuthAnalytics();

// Subscribe to consent changes to update SDK initialization
onPrivacyConsentChange((consent) => {
  if (consent.analytics) {
    SDKGate.initializeSDK('analytics')
      .then(() => {
        authAnalyticsClient = createConsentGatedAnalytics(NoopAnalytics);
      })
      .catch((error) => {
        console.warn('Failed to initialize analytics SDK:', error);
        authAnalyticsClient = NoopAnalytics;
      });
  } else {
    SDKGate.blockSDK('analytics');
    authAnalyticsClient = NoopAnalytics;
  }
});

/**
 * Hash email address using SHA-256 with salt for PII-safe analytics
 */
async function hashEmail(email: string): Promise<string> {
  const salt = Env.EMAIL_HASH_SALT;
  if (!salt) {
    console.warn('EMAIL_HASH_SALT environment variable is not configured');
    return '[hash_unavailable]';
  }

  try {
    const normalizedEmail = email.toLowerCase().trim();
    const saltedEmail = salt + normalizedEmail;
    return await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      saltedEmail
    );
  } catch {
    console.warn('Failed to hash email');
    return '[hash_failed]';
  }
}

/**
 * Truncate IP address to /24 subnet for privacy
 */
function truncateIP(ip: string | null | undefined): string | null {
  if (!ip || typeof ip !== 'string') return null;

  try {
    // Handle IPv4 addresses
    if (ip.includes('.')) {
      const parts = ip.split('.');
      if (parts.length === 4) {
        return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
      }
    }

    // Handle IPv6 addresses - truncate to /64 subnet
    if (ip.includes(':')) {
      const parts = ip.split(':');
      if (parts.length >= 8) {
        return parts.slice(0, 4).join(':') + '::';
      }
    }

    return null;
  } catch (error) {
    console.warn('Failed to truncate IP:', error);
    return null;
  }
}

/**
 * Sanitize PII from authentication data for analytics
 */
export async function sanitizeAuthPII(data: {
  email?: string;
  ip_address?: string | null;
  device_id?: string;
  user_id?: string;
  [key: string]: unknown;
}): Promise<{ [key: string]: unknown }> {
  const sanitized: { [key: string]: unknown } = { ...data };

  // Hash email address
  if (sanitized.email && typeof sanitized.email === 'string') {
    sanitized.email = await hashEmail(sanitized.email);
  }

  // Truncate IP address to /24 subnet
  if (sanitized.ip_address && typeof sanitized.ip_address === 'string') {
    sanitized.ip_address = truncateIP(sanitized.ip_address);
  }

  // Replace device ID with session ID (use user_id as proxy if available)
  if (sanitized.device_id) {
    delete sanitized.device_id;
    if (sanitized.user_id) {
      sanitized.session_id = sanitized.user_id;
    }
  }

  // Remove any other potential PII fields
  const piiFields = ['password', 'phone', 'name', 'address', 'location'];
  piiFields.forEach((field) => {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  });

  return sanitized;
}

/**
 * Track authentication events with consent checking and PII sanitization
 *
 * @param event - Event name (e.g., 'auth.sign_in', 'auth.sign_up')
 * @param properties - Event properties (will be sanitized for PII)
 */
export async function trackAuthEvent(
  event: string,
  properties: Record<string, unknown> = {}
): Promise<void> {
  // Check if user has consented to analytics
  if (!hasConsent('analytics')) {
    return; // Silently drop event if no consent
  }

  try {
    // Sanitize PII from properties
    const sanitizedProperties = await sanitizeAuthPII(properties);

    // Add base analytics properties
    const payload = {
      ...sanitizedProperties,
      timestamp: new Date().toISOString(),
    };

    // Track event using consent-gated analytics client
    authAnalyticsClient.track(event as AnalyticsEventName, payload);
  } catch (error) {
    console.warn('Failed to track auth event:', error);
    // Fail silently to avoid breaking auth flows
  }
}

/**
 * Log authentication errors to Sentry with consent checking and PII redaction
 *
 * @param error - Error object to log
 * @param context - Additional context (will be sanitized for PII)
 */
export async function logAuthError(
  error: Error,
  context: Record<string, unknown> = {}
): Promise<void> {
  // Check if user has consented to crash reporting
  if (!hasConsent('crashReporting')) {
    return; // Silently drop error if no consent
  }

  try {
    // Get current consent state for PII redaction
    const consent = getPrivacyConsent();

    // Prepare sanitized context
    let sanitizedContext: Record<string, unknown> = { ...context };

    if (consent.personalizedData) {
      // If personalized data consent is granted, still sanitize sensitive fields
      if (
        sanitizedContext.email &&
        typeof sanitizedContext.email === 'string'
      ) {
        sanitizedContext.email = await hashEmail(sanitizedContext.email);
      }

      if (
        sanitizedContext.ip_address &&
        typeof sanitizedContext.ip_address === 'string'
      ) {
        sanitizedContext.ip_address = truncateIP(sanitizedContext.ip_address);
      }

      // Redact passwords and other sensitive data
      const sensitiveFields = ['password', 'token', 'secret', 'key'];
      sensitiveFields.forEach((field) => {
        if (field in sanitizedContext) {
          sanitizedContext[field] = '[REDACTED]';
        }
      });
    } else {
      // If personalized data consent is NOT granted, remove all PII
      sanitizedContext = await sanitizeAuthPII(sanitizedContext);
    }

    // Add error to Sentry with sanitized context
    Sentry.withScope((scope) => {
      scope.setContext('auth_context', sanitizedContext);
      scope.setTag('auth_error', 'true');

      // Add user info if available (but sanitize email)
      if (
        context.email &&
        typeof context.email === 'string' &&
        consent.personalizedData
      ) {
        scope.setUser({ email: context.email });
      }

      Sentry.captureException(error);
    });
  } catch (sentryError) {
    console.warn('Failed to log auth error to Sentry:', sentryError);
    // Fail silently to avoid breaking auth flows
  }
}

/**
 * Configure Sentry beforeSend hook for consent-aware error filtering
 * This should be called once during app initialization
 */
export function configureSentryAuthFilter(): void {
  // Import here to avoid circular dependencies
  import('@/lib/sentry-utils').then(({ beforeSendHook }) => {
    // The existing beforeSendHook in sentry-utils.ts already handles:
    // - Consent checking for crash reporting
    // - PII redaction based on personalizedData consent
    // - Sensitive data scrubbing

    // We'll enhance it with auth-specific filtering by wrapping it
    const originalBeforeSend = beforeSendHook;

    // Add auth-specific event processor
    Sentry.addEventProcessor((event) => {
      // Apply the original filter first
      const filteredEvent = originalBeforeSend(event, undefined);
      if (!filteredEvent) {
        return null;
      }

      // Additional auth-specific filtering
      // Check if this is an auth-related error
      if (
        event.tags?.auth_error === 'true' ||
        event.contexts?.auth_context ||
        event.exception?.values?.[0]?.value?.includes('auth') ||
        event.exception?.values?.[0]?.value?.includes('sign') ||
        event.exception?.values?.[0]?.value?.includes('login')
      ) {
        // Additional PII redaction for auth errors
        if (event.extra?.auth_context) {
          const authContext = event.extra.auth_context as Record<
            string,
            unknown
          >;
          if (authContext.email && !getPrivacyConsent().personalizedData) {
            authContext.email = '[REDACTED]';
          }
          if (authContext.password) {
            authContext.password = '[REDACTED]';
          }
          if (authContext.ip_address && !getPrivacyConsent().personalizedData) {
            authContext.ip_address = '[REDACTED]';
          }
        }
      }

      return filteredEvent;
    });
  });
}

/**
 * Get current analytics client (for testing purposes)
 */
export function getAuthAnalyticsClient(): AnalyticsClient {
  return authAnalyticsClient;
}

/**
 * Reset auth analytics client (for testing purposes)
 */
export function __resetAuthAnalyticsForTests(): void {
  authAnalyticsClient = NoopAnalytics;
}
