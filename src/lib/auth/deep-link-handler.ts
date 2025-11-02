/**
 * Deep link handler for authentication flows
 *
 * Handles URL parsing, validation, and routing for authentication-related deep links
 * including email verification, password reset, and OAuth callbacks.
 */

import * as Sentry from '@sentry/react-native';
import { router } from 'expo-router';
import { showMessage } from 'react-native-flash-message';

import { useAuth } from '@/lib/auth';
import {
  isAllowedAuthHost,
  isAllowedRedirect,
  sanitizeDeepLinkUrl,
} from '@/lib/navigation/deep-link-allowlist';
import {
  isProtectedDeepLinkPath,
  stashPendingDeepLink,
} from '@/lib/navigation/deep-link-gate';
import * as privacyConsent from '@/lib/privacy-consent';
import { supabase } from '@/lib/supabase';

/**
 * Parsed deep link result
 */
export type ParsedDeepLink = {
  host: string;
  path: string;
  params: URLSearchParams;
} | null;

/**
 * Parse a deep link URL into components
 *
 * @param url - The deep link URL to parse
 * @returns Parsed link data or null if invalid
 */
export function parseDeepLink(url: string): ParsedDeepLink {
  if (!url || typeof url !== 'string') {
    return null;
  }

  try {
    const parsed = new URL(url);

    // Only handle growbro:// scheme for security
    if (parsed.protocol !== 'growbro:') {
      // Log error to Sentry if consent granted
      if (privacyConsent.hasConsent('crashReporting')) {
        Sentry.captureException(new Error('Invalid deep link protocol'), {
          tags: { feature: 'deep-link-parsing' },
          extra: {
            url: sanitizeDeepLinkUrl(url),
            protocol: parsed.protocol,
          },
        });
      }
      return null;
    }

    return {
      host: parsed.hostname,
      path: parsed.pathname === '/' ? '' : parsed.pathname,
      params: parsed.searchParams,
    };
  } catch (error) {
    // Log error to Sentry if consent granted
    if (privacyConsent.hasConsent('crashReporting')) {
      Sentry.captureException(error, {
        tags: { feature: 'deep-link-parsing' },
        extra: {
          url: sanitizeDeepLinkUrl(url),
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }

    return null;
  }
}

/**
 * Validate a redirect path against allowed patterns
 *
 * @param path - Path to validate
 * @returns True if path is allowed or null/empty
 */
export function validateRedirect(path: string | null): boolean {
  if (!path) {
    return false;
  }

  return isAllowedRedirect(path);
}

/**
 * Handle email verification deep links
 *
 * @param tokenHash - Token hash from the verification link
 * @param type - Verification type (signup, email, etc.)
 */
export async function handleEmailVerification(
  tokenHash: string,
  type: string
): Promise<boolean> {
  if (!tokenHash) {
    showMessage({
      message: 'Verification Error',
      description: 'Invalid verification link. Please request a new one.',
      type: 'danger',
    });
    return false;
  }

  try {
    const { error } = await supabase.auth.verifyOtp({
      type: 'email',
      token_hash: tokenHash,
    });

    if (error) {
      if (privacyConsent.hasConsent('crashReporting')) {
        Sentry.captureException(error, {
          tags: { feature: 'email-verification' },
          extra: { tokenHash: '[REDACTED]', type },
        });
      }

      showMessage({
        message: 'Verification Failed',
        description:
          'Email verification failed. Please try again or request a new link.',
        type: 'danger',
      });
      return false;
    }

    // Refetch user data after verification
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (!userError && userData.user) {
      // Update auth store with latest user data
      const authState = useAuth.getState();
      authState.updateUser(userData.user);
    } else if (userError) {
      console.warn(
        'Failed to refetch user after email verification:',
        userError
      );
    }

    showMessage({
      message: 'Email Verified',
      description: 'Your email has been verified successfully!',
      type: 'success',
    });

    return true;
  } catch (error) {
    if (privacyConsent.hasConsent('crashReporting')) {
      Sentry.captureException(error, {
        tags: { feature: 'email-verification' },
        extra: { tokenHash: '[REDACTED]', type },
      });
    }

    showMessage({
      message: 'Verification Error',
      description: 'An unexpected error occurred. Please try again.',
      type: 'danger',
    });
    return false;
  }
}

/**
 * Handle password reset deep links
 *
 * @param tokenHash - Token hash from the reset link
 */
export async function handlePasswordReset(tokenHash: string): Promise<void> {
  if (!tokenHash) {
    showMessage({
      message: 'Reset Error',
      description: 'Invalid reset link. Please request a new one.',
      type: 'danger',
    });
    return;
  }

  try {
    const { error } = await supabase.auth.verifyOtp({
      type: 'recovery',
      token_hash: tokenHash,
    });

    if (error) {
      if (privacyConsent.hasConsent('crashReporting')) {
        Sentry.captureException(error, {
          tags: { feature: 'password-reset' },
          extra: { tokenHash: '[REDACTED]' },
        });
      }

      showMessage({
        message: 'Reset Failed',
        description: 'Password reset verification failed. Please try again.',
        type: 'danger',
      });

      router.replace('/reset-password');
      return;
    }

    // Navigate to password confirmation screen
    router.push('/reset-password-confirm');
  } catch (error) {
    if (privacyConsent.hasConsent('crashReporting')) {
      Sentry.captureException(error, {
        tags: { feature: 'password-reset' },
        extra: { tokenHash: '[REDACTED]' },
      });
    }

    showMessage({
      message: 'Reset Error',
      description: 'An unexpected error occurred. Please try again.',
      type: 'danger',
    });
  }
}

/**
 * Handle OAuth callback deep links
 *
 * @param code - Authorization code from OAuth provider
 */
export async function handleOAuthCallback(code: string): Promise<void> {
  if (!code) {
    showMessage({
      message: 'OAuth Error',
      description: 'Invalid authorization code.',
      type: 'danger',
    });
    router.replace('/login');
    return;
  }

  try {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      if (privacyConsent.hasConsent('crashReporting')) {
        Sentry.captureException(error, {
          tags: { feature: 'oauth-callback' },
          extra: { code: '[REDACTED]' },
        });
      }

      showMessage({
        message: 'Sign In Failed',
        description: 'OAuth authentication failed. Please try again.',
        type: 'danger',
      });

      router.replace('/login');
      return;
    }

    router.replace('/(app)');
  } catch (error) {
    if (privacyConsent.hasConsent('crashReporting')) {
      Sentry.captureException(error, {
        tags: { feature: 'oauth-callback' },
        extra: { code: '[REDACTED]' },
      });
    }

    showMessage({
      message: 'OAuth Error',
      description: 'An unexpected error occurred. Please try again.',
      type: 'danger',
    });
  }
}

/**
 * Validate deep link parameters and host
 *
 * @param parsed - Parsed deep link data
 * @param url - Original URL for logging
 * @returns True if valid, false otherwise
 */
function validateDeepLinkParams(parsed: ParsedDeepLink, url: string): boolean {
  if (!parsed) return false;

  const { host, params } = parsed;

  // Check for redirect parameter and validate it
  const redirect = params.get('redirect');
  if (redirect && !validateRedirect(redirect)) {
    if (privacyConsent.hasConsent('crashReporting')) {
      Sentry.captureMessage('Invalid redirect parameter', {
        level: 'warning',
        tags: { feature: 'deep-link-handler' },
        extra: { redirect, url: sanitizeDeepLinkUrl(url) },
      });
    }

    showMessage({
      message: 'Invalid Link',
      description: 'The redirect destination is not allowed.',
      type: 'danger',
    });
    return false;
  }

  // Check if this looks like an auth link (has auth-related parameters)
  const hasAuthParams =
    params.has('token_hash') || params.has('code') || params.has('token');

  // Validate host for auth operations or suspicious links
  if (
    !isAllowedAuthHost(host) &&
    (hasAuthParams || ['verify-email', 'reset-password', 'auth'].includes(host))
  ) {
    if (privacyConsent.hasConsent('crashReporting')) {
      Sentry.captureMessage('Disallowed deep link host', {
        level: 'warning',
        tags: { feature: 'deep-link-handler' },
        extra: { host, url: sanitizeDeepLinkUrl(url) },
      });
    }

    showMessage({
      message: 'Invalid Link',
      description: 'The link you followed is not allowed.',
      type: 'danger',
    });
    return false;
  }

  return true;
}

/**
 * Handle authentication-related deep links
 *
 * @param host - The deep link host
 * @param params - URL search parameters
 * @param redirect - Optional redirect path
 */
async function handleAuthDeepLinks(
  host: string,
  params: URLSearchParams,
  redirect?: string | null
): Promise<void> {
  switch (host) {
    case 'verify-email': {
      const tokenHash = params.get('token_hash');
      const type = params.get('type') || 'email';
      const verificationSuccess = await handleEmailVerification(
        tokenHash || '',
        type
      );

      // Handle redirect only after successful verification
      if (verificationSuccess && redirect && validateRedirect(redirect)) {
        router.push(redirect);
      }
      break;
    }

    case 'reset-password': {
      const tokenHash = params.get('token_hash');
      await handlePasswordReset(tokenHash || '');
      break;
    }

    case 'auth': {
      const code = params.get('code');
      await handleOAuthCallback(code || '');
      break;
    }
  }
}

/**
 * Handle navigation deep links (non-auth)
 *
 * @param fullPath - The full navigation path
 */
function handleNavigationDeepLink(fullPath: string): void {
  // Normalize path by removing trailing slash (except for root path)
  const normalizedPath = fullPath === '/' ? '/' : fullPath.replace(/\/$/, '');

  const authState = useAuth.getState();

  // Check if user is signed in
  if (authState.status === 'signOut') {
    // User not signed in - check if path requires auth
    if (isProtectedDeepLinkPath(normalizedPath)) {
      // Stash the link for after sign in
      stashPendingDeepLink(normalizedPath);
      router.replace('/login');
    } else {
      // Navigate directly to public route
      router.push(normalizedPath);
    }
  } else {
    // User is signed in - navigate directly
    router.push(normalizedPath);
  }
}

/**
 * Main deep link handler - routes URLs to appropriate handlers
 *
 * @param url - The deep link URL to handle
 */
export async function handleDeepLink(url: string): Promise<void> {
  const parsed = parseDeepLink(url);

  if (!parsed) {
    if (privacyConsent.hasConsent('crashReporting')) {
      Sentry.captureMessage('Invalid deep link format', {
        level: 'warning',
        tags: { feature: 'deep-link-handler' },
        extra: { url: sanitizeDeepLinkUrl(url) },
      });
    }

    showMessage({
      message: 'Invalid Link',
      description: 'The link you followed is invalid or malformed.',
      type: 'danger',
    });
    return;
  }

  if (!validateDeepLinkParams(parsed, url)) {
    return;
  }

  const { host, path, params } = parsed;
  const redirect = params.get('redirect');

  // Route to appropriate handler based on host
  if (['verify-email', 'reset-password', 'auth'].includes(host)) {
    await handleAuthDeepLinks(host, params, redirect);
  } else {
    // Handle non-auth deep links (navigation)
    const fullPath = `/${host}${path}${params.toString() ? `?${params.toString()}` : ''}`;
    handleNavigationDeepLink(fullPath);
  }
}
