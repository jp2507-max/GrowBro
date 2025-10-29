/**
 * Deep link handler for authentication flows
 *
 * Handles email verification, password reset, and OAuth callback deep links.
 * Integrates with Supabase Auth and React Query hooks for secure authentication.
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
import { hasConsent } from '@/lib/privacy-consent';
import { supabase } from '@/lib/supabase';

/**
 * Parse deep link URL and extract parameters
 *
 * @param url - Deep link URL (e.g., growbro://verify-email?token_hash=abc)
 * @returns Parsed components or null if invalid
 */
export function parseDeepLink(url: string): {
  host: string;
  params: URLSearchParams;
} | null {
  try {
    const parsed = new URL(url);

    // Extract host (verify-email, reset-password, etc.)
    const host = parsed.hostname || parsed.pathname.split('/')[0];

    if (!host) {
      return null;
    }

    return {
      host,
      params: parsed.searchParams,
    };
  } catch (error) {
    // Log parsing errors to Sentry if consent granted
    if (hasConsent('crashReporting')) {
      Sentry.captureException(error, {
        tags: { context: 'deep_link_parsing' },
        extra: { url: sanitizeDeepLinkUrl(url) },
      });
    }
    return null;
  }
}

/**
 * Handle email verification deep link
 *
 * Verifies email using Supabase Auth and displays success/error message.
 *
 * @param tokenHash - Token hash from verification email
 * @param type - Verification type ('signup' or 'invite')
 */
export async function handleEmailVerification(
  tokenHash: string,
  type: 'signup' | 'invite' | 'email_change'
): Promise<void> {
  if (!tokenHash || typeof tokenHash !== 'string') {
    showMessage({
      message: translate('auth.error_invalid_token'),
      type: 'danger',
      duration: 5000,
    });
    return;
  }

  try {
    // Verify email using Supabase Auth
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });

    if (error) {
      throw error;
    }

    // Update user state to mark email as verified
    const user = useAuth.getState().user;
    if (user) {
      useAuth.getState().updateUser({
        ...user,
        email_confirmed_at: new Date().toISOString(),
      });
    }

    // Show success message
    showMessage({
      message: translate('auth.email_verification_success'),
      type: 'success',
      duration: 5000,
    });

    // Navigate to main app
    router.replace('/(app)');
  } catch (error: any) {
    // Log error to Sentry if consent granted
    if (hasConsent('crashReporting')) {
      Sentry.captureException(error, {
        tags: { context: 'email_verification' },
        extra: { type },
      });
    }

    // Show error message (use specific key if token is invalid/expired)
    const isTokenError =
      error?.message?.toLowerCase().includes('invalid') ||
      error?.message?.toLowerCase().includes('expired');

    showMessage({
      message: translate(
        isTokenError ? 'auth.error_invalid_token' : 'auth.error_generic'
      ),
      type: 'danger',
      duration: 5000,
    });
  }
}

/**
 * Handle password reset deep link
 *
 * Verifies reset token and navigates to password reset confirmation screen.
 * The actual password update happens on the confirmation screen.
 *
 * @param tokenHash - Token hash from reset email
 */
export async function handlePasswordReset(tokenHash: string): Promise<void> {
  if (!tokenHash || typeof tokenHash !== 'string') {
    showMessage({
      message: translate('auth.error_invalid_token'),
      type: 'danger',
      duration: 5000,
    });
    return;
  }

  try {
    // Verify OTP to establish temporary session
    // This doesn't update the password yet - that happens on the confirm screen
    const { error } = await supabase.auth.verifyOtp({
      type: 'recovery',
      token_hash: tokenHash,
    });

    if (error) {
      throw error;
    }

    // Navigate to password reset confirmation screen
    // User will enter new password there
    router.push('/reset-password-confirm');
  } catch (error: any) {
    // Log error to Sentry if consent granted
    if (hasConsent('crashReporting')) {
      Sentry.captureException(error, {
        tags: { context: 'password_reset_verification' },
      });
    }

    // Show error message
    const isTokenError =
      error?.message?.toLowerCase().includes('invalid') ||
      error?.message?.toLowerCase().includes('expired');

    showMessage({
      message: translate(
        isTokenError ? 'auth.error_invalid_token' : 'auth.error_generic'
      ),
      type: 'danger',
      duration: 5000,
    });

    // Navigate back to reset request screen
    router.replace('/reset-password');
  }
}

/**
 * Handle OAuth callback deep link
 *
 * Exchanges authorization code for session tokens.
 * Called after OAuth provider redirects back to app.
 *
 * @param code - Authorization code from OAuth provider
 */
export async function handleOAuthCallback(code: string): Promise<void> {
  if (!code || typeof code !== 'string') {
    showMessage({
      message: translate('auth.error_oauth_failed', {
        provider: 'OAuth',
      }),
      type: 'danger',
      duration: 5000,
    });
    return;
  }

  try {
    // Exchange code for session
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      throw error;
    }

    // Session is established, auth state will be updated via onAuthStateChange
    // Navigate to main app
    router.replace('/(app)');
  } catch (error: any) {
    // Log error to Sentry if consent granted
    if (hasConsent('crashReporting')) {
      Sentry.captureException(error, {
        tags: { context: 'oauth_callback' },
      });
    }

    // Show error message
    showMessage({
      message: translate('auth.error_oauth_failed', {
        provider: 'OAuth',
      }),
      type: 'danger',
      duration: 5000,
    });

    // Navigate back to login
    router.replace('/login');
  }
}

/**
 * Validate redirect parameter from deep link
 *
 * Checks if redirect path is in allowlist to prevent open redirect vulnerabilities.
 *
 * @param redirect - Redirect path to validate
 * @returns True if redirect is allowed
 */
export function validateRedirect(redirect: string | null): boolean {
  if (!redirect) {
    return false;
  }

  return isAllowedRedirect(redirect);
}

/**
 * Validate and log deep link errors
 */
function validateDeepLinkComponents(
  parsed: { host: string; params: URLSearchParams } | null,
  url: string
): parsed is { host: string; params: URLSearchParams } {
  if (!parsed) {
    if (hasConsent('crashReporting')) {
      Sentry.captureMessage('Invalid deep link URL', {
        level: 'warning',
        tags: { context: 'deep_link_validation' },
        extra: { url: sanitizeDeepLinkUrl(url) },
      });
    }
    return false;
  }

  const { host, params } = parsed;

  if (!isAllowedAuthHost(host)) {
    if (hasConsent('crashReporting')) {
      Sentry.captureMessage('Disallowed deep link host', {
        level: 'warning',
        tags: { context: 'deep_link_validation' },
        extra: { host, url: sanitizeDeepLinkUrl(url) },
      });
    }
    showMessage({
      message: translate('auth.error_generic'),
      type: 'danger',
      duration: 5000,
    });
    return false;
  }

  const redirect = params.get('redirect');
  if (redirect && !validateRedirect(redirect)) {
    if (hasConsent('crashReporting')) {
      Sentry.captureMessage('Invalid redirect parameter', {
        level: 'warning',
        tags: { context: 'deep_link_validation' },
        extra: { redirect, url: sanitizeDeepLinkUrl(url) },
      });
    }
    showMessage({
      message: translate('auth.error_invalid_redirect'),
      type: 'danger',
      duration: 5000,
    });
    return false;
  }

  return true;
}

/**
 * Handle deep link routing based on host
 */
async function handleDeepLinkRoute(
  host: string,
  params: URLSearchParams
): Promise<void> {
  switch (host) {
    case 'verify-email': {
      const tokenHash = params.get('token_hash');
      const type =
        (params.get('type') as 'signup' | 'invite' | 'email_change') ||
        'signup';
      if (tokenHash) {
        await handleEmailVerification(tokenHash, type);
      }
      break;
    }
    case 'reset-password': {
      const tokenHash = params.get('token_hash');
      if (tokenHash) {
        await handlePasswordReset(tokenHash);
      }
      break;
    }
    case 'auth': {
      const code = params.get('code');
      if (code) {
        await handleOAuthCallback(code);
      }
      break;
    }
    default: {
      const path = `/${host}`;
      if (isProtectedDeepLinkPath(path)) {
        const isSignedIn = useAuth.getState().status === 'signIn';
        if (!isSignedIn) {
          stashPendingDeepLink(path);
          router.replace('/login');
        } else {
          router.push(path as any);
        }
      }
    }
  }
}

/**
 * Handle deep link routing with authentication checks
 *
 * Main entry point for processing deep links. Validates host, handles auth flows,
 * and manages protected routes with pending link stashing.
 *
 * @param url - Deep link URL
 */
export async function handleDeepLink(url: string): Promise<void> {
  if (!url || typeof url !== 'string') {
    return;
  }

  const parsed = parseDeepLink(url);

  if (!validateDeepLinkComponents(parsed, url)) {
    return;
  }

  const { host, params } = parsed;
  await handleDeepLinkRoute(host, params);

  const redirect = params.get('redirect');
  if (redirect && validateRedirect(redirect)) {
    router.push(redirect as any);
  }
}
