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
 * Valid deep link routes that can be navigated to from external links
 * These correspond to actual routes in the app structure
 */
const VALID_DEEP_LINK_ROUTES = new Set([
  '/calendar',
  '/community',
  '/settings',
  '/plants',
  '/strains',
  '/playbooks',
  '/inventory',
  '/assessment/capture',
  '/harvest/history',
  '/nutrient',
  '/moderation-dashboard',
  '/sync-diagnostics',
  '/notifications',
] as const);

type ValidDeepLinkRoute =
  typeof VALID_DEEP_LINK_ROUTES extends Set<infer T> ? T : never;

/**
 * Type guard to check if a path is a valid deep link route
 */
function isValidDeepLinkRoute(path: string): path is ValidDeepLinkRoute {
  return VALID_DEEP_LINK_ROUTES.has(path as ValidDeepLinkRoute);
}

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
  type: 'signup' | 'invite' | 'email_change',
  redirect?: string
): Promise<boolean> {
  if (!tokenHash || typeof tokenHash !== 'string') {
    showMessage({
      message: translate('auth.error_invalid_token'),
      type: 'danger',
      duration: 5000,
    });
    return false;
  }

  // Map deprecated 'signup' type to 'email'
  const verifyType = type === 'signup' ? 'email' : type;

  try {
    // Verify email using Supabase Auth
    const { error } = await supabase.auth.verifyOtp({
      type: verifyType,
      token_hash: tokenHash,
    });

    if (error) {
      throw error;
    }

    // Refetch the current user from Supabase to get canonical server state
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) {
      // Log the error but don't fail the verification - the onAuthStateChange listener
      // should still update the user state with the correct data
      console.warn(
        'Failed to refetch user after email verification:',
        userError
      );
    } else if (userData?.user) {
      // Update the auth store with the fresh user data from server
      await useAuth.getState().updateUser(userData.user);
    }

    // Show success message
    showMessage({
      message: translate('auth.email_verification_success'),
      type: 'success',
      duration: 5000,
    });

    // Navigate to redirect if provided, otherwise main app
    if (redirect) {
      router.replace(redirect);
    } else {
      router.replace('/(app)');
    }

    return true;
  } catch (error: any) {
    // Log error to Sentry if consent granted
    if (hasConsent('crashReporting')) {
      Sentry.captureException(error, {
        tags: { context: 'email_verification' },
        extra: { type: verifyType },
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

    return false;
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
export async function handlePasswordReset(
  tokenHash: string,
  redirect?: string
): Promise<boolean> {
  if (!tokenHash || typeof tokenHash !== 'string') {
    showMessage({
      message: translate('auth.error_invalid_token'),
      type: 'danger',
      duration: 5000,
    });
    return false;
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

    // Navigate to redirect if provided, otherwise password reset confirmation screen
    // User will enter new password there
    if (redirect) {
      router.push(redirect);
    } else {
      router.push('/reset-password-confirm');
    }

    return true;
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

    return false;
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
export async function handleOAuthCallback(
  code: string,
  redirect?: string
): Promise<boolean> {
  if (!code || typeof code !== 'string') {
    showMessage({
      message: translate('auth.error_oauth_failed', {
        provider: 'OAuth',
      }),
      type: 'danger',
      duration: 5000,
    });
    return false;
  }

  try {
    // Exchange code for session
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      throw error;
    }

    // Session is established, auth state will be updated via onAuthStateChange
    // Navigate to redirect if provided, otherwise main app
    if (redirect) {
      router.replace(redirect);
    } else {
      router.replace('/(app)');
    }

    return true;
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

    return false;
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

  // Only validate auth hosts for auth-related flows
  // Allow any host for potential protected route handling
  const isAuthFlow = ['verify-email', 'reset-password', 'auth'].includes(host);
  if (isAuthFlow && !isAllowedAuthHost(host)) {
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
// eslint-disable-next-line max-params
async function handleDeepLinkRoute(
  host: string,
  params: URLSearchParams,
  url?: string,
  redirect?: string
): Promise<void> {
  switch (host) {
    case 'verify-email': {
      const tokenHash = params.get('token_hash');
      const type =
        (params.get('type') as 'signup' | 'invite' | 'email_change') ||
        'signup';
      if (tokenHash) {
        await handleEmailVerification(tokenHash, type, redirect);
      }
      break;
    }
    case 'reset-password': {
      const tokenHash = params.get('token_hash');
      if (tokenHash) {
        await handlePasswordReset(tokenHash, redirect);
      }
      break;
    }
    case 'auth': {
      const code = params.get('code');
      if (code) {
        await handleOAuthCallback(code, redirect);
      }
      break;
    }
    default: {
      const path = `/${host}`;
      if (isProtectedDeepLinkPath(path)) {
        if (isValidDeepLinkRoute(path)) {
          const isSignedIn = useAuth.getState().status === 'signIn';
          if (!isSignedIn) {
            stashPendingDeepLink(path);
            router.replace('/login');
          } else {
            // Navigate to redirect if provided, otherwise the requested path
            if (redirect) {
              router.push(redirect);
            } else {
              router.push(path);
            }
          }
        } else {
          // Log invalid deep link route attempts for security monitoring
          if (hasConsent('crashReporting')) {
            Sentry.captureMessage('Invalid deep link route', {
              level: 'warning',
              tags: { context: 'deep_link_validation' },
              extra: {
                host,
                path,
                url: url ? sanitizeDeepLinkUrl(url) : '',
              },
            });
          }
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

  // Validate redirect parameter early
  const redirectParam = params.get('redirect');
  const validatedRedirect =
    redirectParam &&
    validateRedirect(redirectParam) &&
    isValidDeepLinkRoute(redirectParam)
      ? redirectParam
      : undefined;

  await handleDeepLinkRoute(host, params, url, validatedRedirect);
}
