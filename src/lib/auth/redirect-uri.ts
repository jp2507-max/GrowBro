/**
 * Centralized redirect URI utilities for authentication flows
 *
 * Uses expo-auth-session's makeRedirectUri for consistent redirect handling
 * across OAuth, email verification, and password reset flows.
 *
 * Supports both custom scheme (growbro://) and Universal Links (https://growbro.app)
 * for better UX and reliability.
 */

import { Env } from '@env';
import { makeRedirectUri } from 'expo-auth-session';

/**
 * Universal Links domain for production
 * Used for iOS Universal Links and Android App Links
 */
export const UNIVERSAL_LINK_DOMAIN = 'growbro.app';

/**
 * Auth callback paths for deep linking
 */
export const AUTH_PATHS = {
  callback: 'auth/callback',
  verifyEmail: 'verify-email',
  resetPassword: 'reset-password',
} as const;

/**
 * Get the redirect URI for OAuth callbacks
 *
 * Uses makeRedirectUri for proper scheme handling across environments.
 * Falls back to custom scheme if Universal Links are not available.
 *
 * @returns OAuth redirect URI (e.g., 'growbro://auth/callback')
 *
 * @example
 * const redirectUri = getOAuthRedirectUri();
 * await supabase.auth.signInWithOAuth({
 *   provider: 'google',
 *   options: { redirectTo: redirectUri },
 * });
 */
export function getOAuthRedirectUri(): string {
  return makeRedirectUri({
    scheme: Env.SCHEME,
    path: AUTH_PATHS.callback,
  });
}

/**
 * Get the redirect URI for email verification
 *
 * @returns Email verification redirect URI (e.g., 'growbro://verify-email')
 *
 * @example
 * await supabase.auth.signUp({
 *   email,
 *   password,
 *   options: { emailRedirectTo: getEmailVerificationRedirectUri() },
 * });
 */
export function getEmailVerificationRedirectUri(): string {
  return makeRedirectUri({
    scheme: Env.SCHEME,
    path: AUTH_PATHS.verifyEmail,
  });
}

/**
 * Get the redirect URI for password reset
 *
 * @returns Password reset redirect URI (e.g., 'growbro://reset-password')
 *
 * @example
 * await supabase.auth.resetPasswordForEmail(email, {
 *   redirectTo: getPasswordResetRedirectUri(),
 * });
 */
export function getPasswordResetRedirectUri(): string {
  return makeRedirectUri({
    scheme: Env.SCHEME,
    path: AUTH_PATHS.resetPassword,
  });
}

/**
 * Get Universal Link redirect URI for production
 *
 * Universal Links provide better UX:
 * - Opens app directly without browser redirect
 * - Works more reliably with email clients
 * - Required for some OAuth providers
 *
 * @param path - Path for the redirect (e.g., 'auth/callback')
 * @returns Universal Link URI (e.g., 'https://growbro.app/auth/callback')
 */
export function getUniversalLinkRedirectUri(
  path: (typeof AUTH_PATHS)[keyof typeof AUTH_PATHS]
): string {
  return `https://${UNIVERSAL_LINK_DOMAIN}/${path}`;
}

/**
 * Check if a URL is a valid Universal Link for our app
 *
 * @param url - URL to check
 * @returns True if URL is a Universal Link for growbro.app
 */
export function isUniversalLink(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' && parsed.hostname === UNIVERSAL_LINK_DOMAIN
    );
  } catch {
    return false;
  }
}

/**
 * Check if a URL is a valid custom scheme deep link
 *
 * @param url - URL to check
 * @returns True if URL uses growbro:// scheme
 */
export function isCustomSchemeLink(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    const parsed = new URL(url);
    // Check for any growbro scheme variant (growbro://, growbro-dev://, growbro-staging://)
    return parsed.protocol.startsWith('growbro');
  } catch {
    return false;
  }
}

/**
 * Check if a URL is a valid deep link (either custom scheme or Universal Link)
 *
 * @param url - URL to check
 * @returns True if URL is a valid deep link for our app
 */
export function isValidDeepLink(url: string): boolean {
  return isCustomSchemeLink(url) || isUniversalLink(url);
}

/**
 * Get all redirect URIs that should be registered with Supabase
 *
 * Includes both custom scheme and Universal Link variants for all auth flows.
 * Use this to configure Supabase dashboard or config.toml.
 *
 * @returns Array of all redirect URIs to register
 */
export function getAllRedirectUris(): string[] {
  const schemes = ['growbro', 'growbro-dev', 'growbro-staging'];
  const paths = Object.values(AUTH_PATHS);

  const customSchemeUris = schemes.flatMap((scheme) =>
    paths.map((path) => `${scheme}://${path}`)
  );

  const universalLinkUris = paths.map(
    (path) => `https://${UNIVERSAL_LINK_DOMAIN}/${path}`
  );

  return [...customSchemeUris, ...universalLinkUris];
}
