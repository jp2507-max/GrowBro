/**
 * React Query mutation hooks for OAuth authentication
 * Supports Apple and Google sign-in via web flow and native ID token flow
 */

import Env from '@env';
import { createMutation } from 'react-query-kit';

import { useAuth } from '@/lib/auth';
import { logAuthError, trackAuthEvent } from '@/lib/auth/auth-telemetry';
import { supabase } from '@/lib/supabase';

import { mapAuthError } from './error-mapper';
import type {
  ExchangeOAuthCodeVariables,
  OAuthResponse,
  OAuthVariables,
  SignInResponse,
  SignInWithIdTokenVariables,
} from './types';

/**
 * Hook for initiating OAuth sign-in flow
 *
 * Opens OAuth provider's sign-in page in browser and redirects back to app.
 * After redirect, use useExchangeOAuthCode to complete authentication.
 *
 * Requirements:
 * - 2.1: Initiate Apple OAuth flow
 * - 2.2: Initiate Google OAuth flow
 * - 2.4: Display error on OAuth failure
 */
export const useSignInWithOAuth = createMutation<
  OAuthResponse,
  OAuthVariables,
  Error
>({
  mutationFn: async (variables) => {
    const { provider } = variables;

    // Initiate OAuth flow with redirect to app
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${Env.SCHEME}://auth/callback`,
        // For production, you may want to add scopes
        // scopes: 'email profile',
      },
    });

    if (error) {
      const errorKey = mapAuthError(error);
      throw new Error(errorKey);
    }

    if (!data.url) {
      throw new Error('auth.error_oauth_failed');
    }

    return {
      provider,
      url: data.url,
    };
  },

  onError: async (error: Error, variables) => {
    await logAuthError(error, {
      errorKey: error.message,
      flow: 'oauth_initiate',
      provider: variables.provider,
    });
  },
});

/**
 * Hook for exchanging OAuth authorization code for session
 *
 * Called after OAuth redirect returns to app with authorization code.
 *
 * Requirements:
 * - 2.3: Exchange code for session
 * - 2.5: Create new account with provider's email
 * - 2.6: Link OAuth provider to existing account
 */
export const useExchangeOAuthCode = createMutation<
  SignInResponse,
  ExchangeOAuthCodeVariables,
  Error
>({
  mutationFn: async (variables) => {
    const { code } = variables;

    // Exchange code for session
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      const errorKey = mapAuthError(error);
      throw new Error(errorKey);
    }

    if (!data.session || !data.user) {
      throw new Error('auth.error_oauth_failed');
    }

    return {
      session: data.session,
      user: data.user,
    };
  },

  onSuccess: async (data) => {
    // Update Zustand auth store
    const { signIn: storeSignIn } = useAuth.getState();
    storeSignIn({
      session: data.session,
      user: data.user,
    });

    // Track analytics event with consent checking and PII sanitization
    await trackAuthEvent('auth.sign_in', {
      method: 'oauth',
      provider: 'web', // Will be determined by the OAuth provider used
      email: data.user.email,
      user_id: data.user.id,
    });
  },

  onError: async (error: Error) => {
    await logAuthError(error, {
      errorKey: error.message,
      flow: 'oauth_code_exchange',
      method: 'oauth',
    });
  },
});

/**
 * Hook for native OAuth sign-in with ID token
 *
 * Uses platform-specific OAuth libraries (e.g., expo-apple-authentication,
 * @react-native-google-signin/google-signin) to get ID token, then exchanges
 * with Supabase.
 *
 * Provides better UX than web flow (native UI, biometric auth support).
 *
 * Requirements:
 * - 2.1: Initiate Apple OAuth flow (native)
 * - 2.2: Initiate Google OAuth flow (native)
 * - 2.5: Create new account
 * - 2.6: Link to existing account
 */
export const useSignInWithIdToken = createMutation<
  SignInResponse,
  SignInWithIdTokenVariables,
  Error
>({
  mutationFn: async (variables) => {
    const { provider, idToken, nonce } = variables;

    // Sign in with ID token from native OAuth
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider,
      token: idToken,
      nonce,
    });

    if (error) {
      const errorKey = mapAuthError(error);
      throw new Error(errorKey);
    }

    if (!data.session || !data.user) {
      throw new Error('auth.error_oauth_failed');
    }

    return {
      session: data.session,
      user: data.user,
    };
  },

  onSuccess: async (data, variables) => {
    // Update Zustand auth store
    const { signIn: storeSignIn } = useAuth.getState();
    storeSignIn({
      session: data.session,
      user: data.user,
    });

    // Track analytics event with consent checking and PII sanitization
    await trackAuthEvent('auth.sign_in', {
      method: `${variables.provider}_native`,
      provider: variables.provider,
      email: data.user.email,
      user_id: data.user.id,
    });
  },

  onError: async (error: Error, variables) => {
    await logAuthError(error, {
      errorKey: error.message,
      flow: 'oauth_native',
      method: `${variables.provider}_native`,
      provider: variables.provider,
    });
  },
});
