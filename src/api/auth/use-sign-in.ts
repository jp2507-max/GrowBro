/**
 * React Query mutation hook for email/password sign in
 * Implements brute-force protection via Edge Function wrapper
 */

import { Env } from '@env';
import Constants from 'expo-constants';
import { createMutation } from 'react-query-kit';

import { useAuth } from '@/lib/auth';
import { logAuthError, trackAuthEvent } from '@/lib/auth/auth-telemetry';

import { mapAuthError } from './error-mapper';
import type { SignInResponse, SignInVariables } from './types';

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

      // Get Supabase URL from environment
      const supabaseUrl =
        Env?.SUPABASE_URL || Env?.EXPO_PUBLIC_SUPABASE_URL || '';
      if (!supabaseUrl) {
        throw new Error('Missing SUPABASE_URL environment variable');
      }

      // Call Edge Function for lockout-protected sign in
      const response = await fetch(
        `${supabaseUrl}/functions/v1/enforce-auth-lockout`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            password,
            appVersion:
              appVersion || Constants.expoConfig?.version || 'Unknown',
          }),
        }
      );

      const data = await response.json();

      // Handle error response
      if (!response.ok || !data.success) {
        const errorKey = mapAuthError(data);
        const error = new Error(errorKey) as Error & {
          code?: string;
          metadata?: any;
        };
        error.code = data.code;
        error.metadata = data.metadata;
        throw error;
      }

      // Extract session and user from response
      const { session, user } = data;

      if (!session || !user) {
        throw new Error('auth.error_generic');
      }

      // Convert to Supabase Session/User format
      const supabaseSession = {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_in: session.expires_in,
        expires_at: session.expires_at,
        token_type: 'bearer' as const,
        user,
      };

      return {
        session: supabaseSession,
        user,
      };
    },

    onSuccess: async (data) => {
      // Update Zustand auth store (which handles Supabase client session)
      const { signIn: storeSignIn } = useAuth.getState();
      storeSignIn({
        session: data.session,
        user: data.user,
      });

      // Track analytics event with consent checking and PII sanitization
      await trackAuthEvent('auth.sign_in', {
        method: 'email',
        email: data.user.email,
        user_id: data.user.id,
        ip_address: null, // Will be populated by Edge Function if available
      });
    },

    onError: async (error: Error & { code?: string; metadata?: any }) => {
      // Log error for debugging with consent checking
      await logAuthError(error, {
        errorKey: error.message,
        code: error.code,
        hasLockout: error.metadata?.lockout,
        flow: 'sign_in',
        method: 'email',
      });
    },
  }
);
