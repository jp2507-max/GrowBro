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

// Auth error context for pattern matching
type AuthErrorContext = {
  message: string;
  status?: number;
  name: string;
  normalizedCode: string;
};

/** Check for weak password errors */
function checkWeakPassword(ctx: AuthErrorContext): string | null {
  const { message, name, normalizedCode } = ctx;
  if (
    normalizedCode === 'weakpassword' ||
    name.includes('weakpassword') ||
    message.includes('password should contain at least one character') ||
    message.includes('known to be weak') ||
    message.includes('does not meet the security requirements') ||
    (message.includes('password') &&
      (message.includes('weak') ||
        message.includes('too short') ||
        message.includes('requirements')))
  ) {
    return 'auth.error_password_weak';
  }
  return null;
}

/** Check for credential/status-based errors */
function checkCredentialErrors(ctx: AuthErrorContext): string | null {
  const { message, status } = ctx;
  if (
    status === 400 ||
    status === 401 ||
    message.includes('invalid login credentials') ||
    message.includes('invalid email or password') ||
    message.includes('email not confirmed')
  ) {
    return 'auth.error_invalid_credentials';
  }
  if (
    status === 422 ||
    message.includes('already registered') ||
    message.includes('email already exists')
  ) {
    return 'auth.error_email_exists';
  }
  if (message.includes('invalid email') || message.includes('email format')) {
    return 'auth.error_email_invalid';
  }
  if (status === 429 || message.includes('rate limit')) {
    return 'auth.error_rate_limit';
  }
  return null;
}

/** Check for network/token/session errors */
function checkSessionErrors(ctx: AuthErrorContext): string | null {
  const { message } = ctx;
  if (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('timeout')
  ) {
    return 'auth.error_network';
  }
  if (
    message.includes('token') ||
    message.includes('session') ||
    message.includes('expired')
  ) {
    return message.includes('invalid') || message.includes('malformed')
      ? 'auth.error_invalid_token'
      : 'auth.error_session_expired';
  }
  if (message.includes('oauth') || message.includes('provider')) {
    return 'auth.error_oauth_failed';
  }
  if (message.includes('verification') || message.includes('confirm')) {
    return message.includes('expired') || message.includes('invalid')
      ? 'auth.error_invalid_token'
      : 'auth.error_verification_failed';
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return 'auth.error_offline_login';
  }
  return null;
}

/** Map Supabase AuthError to i18n keys */
function mapSupabaseAuthError(error: UnknownError): string {
  const authError = error as AuthError & { code?: string };
  const ctx: AuthErrorContext = {
    message: authError?.message?.toLowerCase() || '',
    status: authError?.status,
    name: authError?.name?.toLowerCase() || '',
    normalizedCode: (authError?.code || '').toLowerCase().replace(/_/g, ''),
  };

  return (
    checkWeakPassword(ctx) ||
    checkCredentialErrors(ctx) ||
    checkSessionErrors(ctx) ||
    'auth.error_generic'
  );
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
