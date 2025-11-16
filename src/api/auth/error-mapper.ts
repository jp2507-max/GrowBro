/**
 * Error mapper for authentication operations
 * Maps Supabase Auth errors to localized i18n keys
 */

import type { AuthError } from '@supabase/supabase-js';

import type { AuthErrorResponse } from './types';

// Edge Function error structure
interface EdgeFunctionError {
  code?: string;
  metadata?: {
    lockout?: boolean;
    minutes_remaining?: number;
  };
}

// Generic error with unknown structure
type UnknownError = unknown;

/**
 * Map authentication errors to i18n translation keys
 * Uses pattern-based matching with safe fallback to prevent account enumeration
 *
 * @param error - Error from Supabase Auth or Edge Function
 * @returns i18n translation key
 */
export function mapAuthError(error: UnknownError): string {
  // Handle Edge Function error responses
  const edgeFunctionError = mapEdgeFunctionError(error);
  if (edgeFunctionError) return edgeFunctionError;

  // Handle Supabase AuthError
  return mapSupabaseAuthError(error);
}

/**
 * Map Edge Function error codes to i18n keys
 */
function mapEdgeFunctionError(error: UnknownError): string | null {
  // Type guard to check if error has Edge Function structure
  if (
    typeof error !== 'object' ||
    error === null ||
    !('code' in error) ||
    typeof error.code !== 'string'
  ) {
    return null;
  }

  const edgeError = error as EdgeFunctionError;

  switch (edgeError.code) {
    case 'INVALID_CREDENTIALS':
      return edgeError.metadata?.lockout
        ? 'auth.error_account_locked'
        : 'auth.error_invalid_credentials';
    case 'AUTH_ERROR':
    case 'INTERNAL_ERROR':
      return 'auth.error_generic';
    default:
      return null;
  }
}

/**
 * Map Supabase AuthError to i18n keys
 */
function mapSupabaseAuthError(error: UnknownError): string {
  const authError = error as AuthError;
  const message = authError?.message?.toLowerCase() || '';
  const status = authError?.status;

  // Invalid credentials (400/401)
  if (
    status === 400 ||
    status === 401 ||
    message.includes('invalid login credentials') ||
    message.includes('invalid email or password') ||
    message.includes('email not confirmed')
  ) {
    return 'auth.error_invalid_credentials';
  }

  // Email already in use (422)
  if (
    status === 422 ||
    message.includes('already registered') ||
    message.includes('email already exists')
  ) {
    return 'auth.error_email_exists';
  }

  // Weak password
  if (
    message.includes('password') &&
    (message.includes('weak') ||
      message.includes('too short') ||
      message.includes('requirements'))
  ) {
    return 'auth.error_password_weak';
  }

  // Invalid email format
  if (message.includes('invalid email') || message.includes('email format')) {
    return 'auth.error_email_invalid';
  }

  // Rate limiting (429)
  if (status === 429 || message.includes('rate limit')) {
    return 'auth.error_rate_limit';
  }

  // Network/connectivity errors
  if (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('timeout')
  ) {
    return 'auth.error_network';
  }

  // Token/session errors
  if (
    message.includes('token') ||
    message.includes('session') ||
    message.includes('expired')
  ) {
    // Distinguish between general session expiry and invalid tokens
    if (message.includes('invalid') || message.includes('malformed')) {
      return 'auth.error_invalid_token';
    }
    return 'auth.error_session_expired';
  }

  // OAuth specific errors
  if (message.includes('oauth') || message.includes('provider')) {
    return 'auth.error_oauth_failed';
  }

  // Email verification errors
  if (message.includes('verification') || message.includes('confirm')) {
    if (message.includes('expired') || message.includes('invalid')) {
      return 'auth.error_invalid_token';
    }
    return 'auth.error_verification_failed';
  }

  // Offline/network check (must come after specific checks)
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return 'auth.error_offline_login';
  }

  // Fallback to generic error (never reveal specific details)
  return 'auth.error_generic';
}

/**
 * Extract user-friendly error message from Edge Function response
 *
 * @param response - Response from Edge Function
 * @returns User-friendly error message or null
 */
export function extractErrorMessage(
  response: AuthErrorResponse
): string | null {
  if (response.metadata?.lockout && response.metadata?.minutes_remaining) {
    return `auth.error_account_locked_with_time:${response.metadata.minutes_remaining}`;
  }

  return null;
}

/**
 * Check if error indicates account lockout
 *
 * @param error - Error response
 * @returns True if account is locked
 */
export function isAccountLocked(error: UnknownError): boolean {
  if (
    typeof error !== 'object' ||
    error === null ||
    !('code' in error) ||
    !('metadata' in error)
  ) {
    return false;
  }

  const edgeError = error as EdgeFunctionError;
  return (
    edgeError.code === 'INVALID_CREDENTIALS' &&
    edgeError.metadata?.lockout === true
  );
}

/**
 * Get remaining lockout time in minutes
 *
 * @param error - Error response with lockout metadata
 * @returns Minutes remaining or null
 */
export function getLockoutMinutes(error: UnknownError): number | null {
  if (isAccountLocked(error)) {
    const edgeError = error as EdgeFunctionError;
    return edgeError.metadata?.minutes_remaining || null;
  }
  return null;
}
