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
import { translate } from '@/lib/i18n';
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

import { isCustomSchemeLink, isUniversalLink } from './redirect-uri';

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
 * Supports both custom scheme (growbro://) and Universal Links (https://growbro.app)
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

    // Handle Universal Links (https://growbro.app/...)
    if (isUniversalLink(url)) {
      // For Universal Links, the path becomes the host in our internal format
      // e.g., https://growbro.app/verify-email?token_hash=... -> host: 'verify-email'
      const pathParts = parsed.pathname.split('/').filter(Boolean);
      const host = pathParts[0] || '';
      const remainingPath = pathParts.slice(1).join('/');

      return {
        host,
        path: remainingPath ? `/${remainingPath}` : '',
        params: parsed.searchParams,
      };
    }

    // Handle custom scheme (growbro://, growbro-dev://, growbro-staging://)
    if (isCustomSchemeLink(url)) {
      return {
        host: parsed.hostname,
        path: parsed.pathname === '/' ? '' : parsed.pathname,
        params: parsed.searchParams,
      };
    }

    // Unknown scheme - reject for security
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
 * Check if an error is a transient network error (safe to retry)
 * Does not include code exchange errors which are non-idempotent
 */
function isTransientNetworkError(error: unknown): boolean {
  if (!error) return false;

  const errorMessage =
    error instanceof Error ? error.message.toLowerCase() : '';
  const errorName = error instanceof Error ? error.name.toLowerCase() : '';

  // OAuth code errors are NOT retryable (code is single-use)
  const isCodeError =
    errorMessage.includes('invalid grant') ||
    errorMessage.includes('invalid code') ||
    errorMessage.includes('expired') ||
    errorMessage.includes('authorization code');

  if (isCodeError) return false;

  // Only retry on clear network/connectivity issues
  return (
    errorMessage.includes('network request failed') ||
    errorMessage.includes('fetch failed') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('econnrefused') ||
    errorMessage.includes('enotfound') ||
    errorName === 'networkerror' ||
    errorName === 'fetcherror'
  );
}

/**
 * Check if user already has a valid session
 * Used to detect successful code exchange despite client timeout
 */
async function hasValidSession(): Promise<boolean> {
  try {
    const { data, error } = await supabase.auth.getSession();
    return !error && !!data.session;
  } catch {
    return false;
  }
}

/**
 * OAuth retry configuration
 */
const OAUTH_MAX_RETRIES = 2;
const OAUTH_RETRY_DELAY_MS = 1500; // 1.5 seconds

const OAUTH_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Track successfully exchanged codes to avoid false positives in retry logic
 * Cleared on app restart or after TTL
 */
const exchangedCodes = new Set<string>();

/**
 * Track timeouts for exchanged codes to prevent memory leaks
 */
const exchangedCodeTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
const MAX_TIMEOUT_TRACKING = 100;

/**
 * Track an exchanged code with proper timeout cleanup
 */
function trackExchangedCode(code: string): void {
  const existing = exchangedCodeTimeouts.get(code);
  if (existing) {
    clearTimeout(existing);
  }

  // FIFO eviction if we exceed the limit
  if (exchangedCodeTimeouts.size >= MAX_TIMEOUT_TRACKING) {
    const firstKey = exchangedCodeTimeouts.keys().next().value;
    if (firstKey) {
      const firstTimeout = exchangedCodeTimeouts.get(firstKey);
      if (firstTimeout) clearTimeout(firstTimeout);
      exchangedCodeTimeouts.delete(firstKey);
      exchangedCodes.delete(firstKey);
    }
  }

  const timeout = setTimeout(() => {
    exchangedCodes.delete(code);
    exchangedCodeTimeouts.delete(code);
  }, OAUTH_CODE_TTL_MS);

  exchangedCodes.add(code);
  exchangedCodeTimeouts.set(code, timeout);
}

/**
 * Show retry message and retry OAuth callback after delay
 * Checks for existing session first in case code was already exchanged
 */
async function retryOAuthWithDelay(
  code: string,
  retryCount: number
): Promise<void> {
  console.log(
    `[OAuth] Transient network error detected, checking for existing session...`
  );

  // Check if THIS code was already successfully exchanged
  if (exchangedCodes.has(code)) {
    console.log('[OAuth] This code was successfully exchanged despite timeout');
    showMessage({
      message: 'Sign In Successful',
      description: 'You have been signed in successfully.',
      type: 'success',
    });
    router.replace('/(app)');
    return;
  }

  // Session exists but not from this code - another OAuth flow succeeded
  const sessionExists = await hasValidSession();
  if (sessionExists) {
    console.log(
      '[OAuth] Different OAuth flow succeeded - abandoning this code exchange'
    );
    router.replace('/(app)');
    return;
  }

  console.log(
    `[OAuth] No existing session found, retrying code exchange... (${retryCount + 1}/${OAUTH_MAX_RETRIES})`
  );

  showMessage({
    message: translate('auth.network_issue'),
    description: translate('auth.retrying_connection', {
      attempt: retryCount + 1,
      max: OAUTH_MAX_RETRIES,
    }),
    type: 'warning',
    duration: OAUTH_RETRY_DELAY_MS,
  });

  await new Promise((resolve) => setTimeout(resolve, OAUTH_RETRY_DELAY_MS));
  return handleOAuthCallback(code, retryCount + 1);
}

/**
 * Handle OAuth exchange error
 */
/**
 * Consolidated OAuth error handler
 */
function handleOAuthError(
  error: unknown,
  retryCount: number,
  context: 'exchange' | 'unexpected'
): void {
  const errorMessage =
    error instanceof Error ? error.message.toLowerCase() : '';
  const isCodeReused =
    errorMessage.includes('invalid grant') ||
    errorMessage.includes('invalid code');

  if (privacyConsent.hasConsent('crashReporting')) {
    Sentry.captureException(error, {
      tags: { feature: 'oauth-callback' },
      extra: {
        code: '[REDACTED]',
        isTransientNetworkError: isTransientNetworkError(error),
        isCodeReused,
        retryCount,
        context,
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    });
  }

  const isNetwork = isTransientNetworkError(error);
  const messages = {
    exchange: {
      title: translate('auth.sign_in_failed'),
      network: translate('auth.network_connection_issue'),
      default: translate('auth.oauth_failed'),
    },
    unexpected: {
      title: translate('auth.oauth_error'),
      network: translate('auth.network_connection_issue'),
      default: translate('auth.unexpected_error'),
    },
  };

  let description: string;
  if (isCodeReused) {
    description = translate('auth.code_already_used');
  } else if (isNetwork) {
    description = messages[context].network;
  } else {
    description = messages[context].default;
  }

  showMessage({
    message: messages[context].title,
    description,
    type: 'danger',
  });

  router.replace('/login');
}

/**
 * Handle OAuth callback deep links with retry logic for network errors
 *
 * @param code - Authorization code from OAuth provider
 * @param retryCount - Current retry attempt (internal use)
 */
export async function handleOAuthCallback(
  code: string,
  retryCount = 0
): Promise<void> {
  if (!code) {
    showMessage({
      message: translate('auth.oauth_error'),
      description: translate('auth.invalid_authorization_code'),
      type: 'danger',
    });
    router.replace('/login');
    return;
  }

  try {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      // Only retry on transient network errors (not code-exchange errors)
      if (isTransientNetworkError(error) && retryCount < OAUTH_MAX_RETRIES) {
        return retryOAuthWithDelay(code, retryCount);
      }

      handleOAuthError(error, retryCount, 'exchange');
      return;
    }

    // Mark code as successfully exchanged
    trackExchangedCode(code);

    // Success - navigate to app
    showMessage({
      message: translate('auth.sign_in_successful'),
      description: translate('auth.signed_in_successfully'),
      type: 'success',
    });
    router.replace('/(app)');
  } catch (error) {
    // Only retry on transient network errors (not code-exchange errors)
    if (isTransientNetworkError(error) && retryCount < OAUTH_MAX_RETRIES) {
      return retryOAuthWithDelay(code, retryCount);
    }

    handleOAuthError(error, retryCount, 'unexpected');
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
