/**
 * Deep link allowlist configuration
 *
 * Defines allowed redirect paths and authentication hosts for deep link security.
 * Uses minimatch patterns for flexible path matching while preventing open redirects.
 */

// @ts-ignore - minimatch has its own types but TypeScript can't find them
import { minimatch } from 'minimatch';

/**
 * Allowed redirect paths for deep links
 * Uses glob patterns for flexible matching (e.g., /settings/* matches any settings subpath)
 */
export const ALLOWED_REDIRECT_PATHS = [
  '/settings',
  '/settings/*',
  '/settings/profile',
  '/settings/notifications',
  '/settings/privacy-and-data',
  '/settings/security',
  '/settings/support',
  '/settings/legal',
  '/settings/about',
  '/settings/storage',
  '/settings/active-sessions',
  '/plants/*',
  '/feed/*',
  '/calendar/*',
  '/notifications/*',
  '/(app)/*',
  '/profile',
  '/profile/*',
];

/**
 * Allowed authentication hosts for deep links
 * Only these hosts are valid for authentication-related deep links
 */
export const ALLOWED_AUTH_HOSTS = ['auth', 'verify-email', 'reset-password'];

/**
 * Check if a redirect path is allowed
 *
 * @param path - Path to validate (e.g., /settings/profile)
 * @returns True if path matches any allowed pattern
 *
 * @example
 * isAllowedRedirect('/settings/profile') // true
 * isAllowedRedirect('/admin/users') // false
 */
export function isAllowedRedirect(path: string): boolean {
  if (!path || typeof path !== 'string') {
    return false;
  }

  // Normalize path (ensure leading slash)
  const normalized = path.startsWith('/') ? path : `/${path}`;

  // Check against allowed patterns
  return ALLOWED_REDIRECT_PATHS.some((pattern) =>
    minimatch(normalized, pattern)
  );
}

/**
 * Check if an authentication host is allowed
 *
 * @param host - Host to validate (e.g., verify-email)
 * @returns True if host is in allowlist
 *
 * @example
 * isAllowedAuthHost('verify-email') // true
 * isAllowedAuthHost('phishing-site') // false
 */
export function isAllowedAuthHost(host: string): boolean {
  if (!host || typeof host !== 'string') {
    return false;
  }

  return ALLOWED_AUTH_HOSTS.includes(host.toLowerCase());
}

/**
 * Sanitize URL for logging (redact sensitive parameters)
 *
 * @param url - URL to sanitize
 * @returns Sanitized URL safe for logging
 *
 * @example
 * sanitizeDeepLinkUrl('growbro://verify-email?token_hash=abc123')
 * // 'growbro://verify-email?token_hash=[REDACTED]'
 */
export function sanitizeDeepLinkUrl(url: string): string {
  if (!url || typeof url !== 'string') {
    return '[INVALID_URL]';
  }

  try {
    const parsed = new URL(url);

    // Redact sensitive query parameters
    const sensitiveParams = [
      'token_hash',
      'token',
      'code',
      'access_token',
      'refresh_token',
    ];

    sensitiveParams.forEach((param) => {
      if (parsed.searchParams.has(param)) {
        parsed.searchParams.set(param, '[REDACTED]');
      }
    });

    return parsed.toString();
  } catch {
    // If URL parsing fails, return generic placeholder
    return '[MALFORMED_URL]';
  }
}
