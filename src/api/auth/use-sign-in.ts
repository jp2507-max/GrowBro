/**
 * React Query mutation hook for email/password sign in
 * Implements brute-force protection via Edge Function wrapper
 */

import { Env } from '@env';
import type { Session, User } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { createMutation } from 'react-query-kit';

import { useAuth } from '@/lib/auth';
import { logAuthError, trackAuthEvent } from '@/lib/auth/auth-telemetry';

import type {
  AuthErrorResponse,
  SignInResponse,
  SignInVariables,
} from './types';

// Extended Error type with auth metadata
type AuthMutationError = Error & {
  code?: string;
  metadata?: { lockout?: boolean; minutes_remaining?: number };
};

// Edge Function response types
interface EdgeFunctionSuccessResponse {
  success: true;
  session: {
    access_token: string;
    refresh_token: string;
    expires_at: number;
    expires_in: number;
  };
  user: {
    id: string;
    email: string;
    email_confirmed_at: string | null;
    created_at: string;
    user_metadata: Record<string, unknown>;
    app_metadata: Record<string, unknown>;
    aud: string;
    role?: string;
  };
}

type EdgeFunctionResponse = EdgeFunctionSuccessResponse | AuthErrorResponse;

/** Get Supabase config from environment */
function getSupabaseConfig(): { url: string; anonKey: string } {
  const url = Env?.SUPABASE_URL || Env?.EXPO_PUBLIC_SUPABASE_URL || '';
  const anonKey =
    Env?.SUPABASE_ANON_KEY || Env?.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
  return { url, anonKey };
}

/** Call Edge Function and parse response */
async function callEdgeFunction(
  email: string,
  password: string,
  appVersion?: string
): Promise<EdgeFunctionResponse> {
  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) throw new Error('auth.error_generic');

  const response = await fetch(`${url}/functions/v1/enforce-auth-lockout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      Accept: 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      appVersion: appVersion || Constants.expoConfig?.version || 'unknown',
    }),
  });

  if (__DEV__) console.log('[SignIn] Edge Function status:', response.status);

  const raw = await response.text();

  try {
    const parsed: EdgeFunctionResponse = JSON.parse(raw);
    return { ...parsed, _httpOk: response.ok } as EdgeFunctionResponse & {
      _httpOk: boolean;
    };
  } catch {
    if (__DEV__) {
      console.warn('[SignIn] Failed to parse response as JSON', {
        status: response.status,
        raw: raw?.slice?.(0, 200),
      });
    }
    const error = new Error('auth.error_generic') as AuthMutationError;
    error.code = 'invalid_response';
    throw error;
  }
}

/** Handle error response from Edge Function */
function handleErrorResponse(
  result: EdgeFunctionResponse,
  _httpOk: boolean
): never {
  const isValidError =
    result &&
    typeof result === 'object' &&
    'error' in result &&
    typeof (result as AuthErrorResponse).error === 'string' &&
    'code' in result;

  const errResp: AuthErrorResponse = isValidError
    ? (result as AuthErrorResponse)
    : { error: 'auth.error_generic', code: 'unknown_error' };

  if (__DEV__) {
    console.warn('[SignIn] Edge Function error', {
      code: errResp.code,
      error: errResp.error,
      metadata: errResp.metadata,
    });
  }

  const error = new Error(errResp.error) as AuthMutationError;
  error.code = errResp.code;
  error.metadata = errResp.metadata;
  throw error;
}

/** Build Session object from Edge Function response */
function buildSession(
  edgeSession: EdgeFunctionSuccessResponse['session'],
  edgeUser: EdgeFunctionSuccessResponse['user']
): Session {
  return {
    access_token: edgeSession.access_token,
    refresh_token: edgeSession.refresh_token,
    expires_at: edgeSession.expires_at,
    expires_in: edgeSession.expires_in,
    token_type: 'bearer',
    user: {
      id: edgeUser.id,
      email: edgeUser.email ?? '',
      email_confirmed_at: edgeUser.email_confirmed_at,
      created_at: edgeUser.created_at,
      user_metadata: edgeUser.user_metadata ?? {},
      app_metadata: edgeUser.app_metadata ?? {},
      aud: edgeUser.aud,
      role: edgeUser.role,
    } as User,
  };
}

/**
 * Hook for signing in with email and password
 *
 * Uses the enforce-auth-lockout Edge Function to:
 * - Check lockout status before attempting sign in
 * - Increment failed attempt counter on invalid credentials
 * - Reset counter on successful sign in
 * - Capture device metadata
 *
 * Requirements:
 * - 1.2: Authenticate user and establish session
 * - 1.3: Display error without revealing email existence
 * - 1.5: Store session tokens and update Zustand
 * - 8.1: Lock account after 5 failed attempts
 * - 8.6: Return generic error during lockout
 * - 11.1: Track analytics only if consented
 */
export const useSignIn = createMutation<SignInResponse, SignInVariables, Error>(
  {
    mutationFn: async (variables) => {
      const { email, password, appVersion } = variables;
      const startedAt = Date.now();
      if (__DEV__) console.log('[SignIn] starting sign-in via Edge Function');

      // Call Edge Function with brute-force protection (Req 8.1)
      const result = (await callEdgeFunction(
        email,
        password,
        appVersion
      )) as EdgeFunctionResponse & { _httpOk?: boolean };
      const httpOk = result._httpOk ?? true;

      // Handle error responses
      if (!httpOk || !('success' in result) || !result.success) {
        handleErrorResponse(result, httpOk);
      }

      // Build session from Edge Function response
      const { session: edgeSession, user: edgeUser } = result;
      if (__DEV__) {
        console.log('[SignIn] success in', Date.now() - startedAt, 'ms');
      }

      const session = buildSession(edgeSession, edgeUser);
      const user: User = session.user;

      // Update auth store (must happen in mutationFn, not onSuccess)
      if (__DEV__) console.log('[SignIn] updating auth store');
      await useAuth.getState().signIn({ session, user });
      if (__DEV__) console.log('[SignIn] auth store updated');

      return { session, user };
    },

    onSuccess: async (data) => {
      // Track analytics event with consent checking and PII sanitization
      // Note: Auth store update moved to mutationFn to ensure it always runs
      if (__DEV__) {
        console.log('[SignIn] onSuccess - tracking analytics');
      }
      await trackAuthEvent('auth_sign_in', {
        method: 'email',
        email: data.user.email,
        user_id: data.user.id,
        ip_address: null, // Will be populated by Edge Function if available
      });
      if (__DEV__) {
        console.log('[SignIn] onSuccess complete');
      }
    },

    onError: async (error: AuthMutationError) => {
      if (__DEV__) {
        console.warn('[SignIn] onError', error);
      }
      // Log error for debugging with consent checking
      await logAuthError(error, {
        errorKey: error.message,
        code: error.code,
        hasLockout: error.metadata?.lockout,
        flow: 'sign_in',
        method: 'email',
      });
    },
    onSettled: () => {
      if (__DEV__) {
        console.log('[SignIn] settled');
      }
    },
  }
);
