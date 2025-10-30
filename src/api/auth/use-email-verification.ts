/**
 * Email verification hooks
 *
 * Provides React Query mutations for email verification flows:
 * - Verify email with OTP token
 * - Resend verification email
 */

import { createMutation } from 'react-query-kit';

import { useAuth } from '@/lib/auth';
import { logAuthError, trackAuthEvent } from '@/lib/auth/auth-telemetry';
import { supabase } from '@/lib/supabase';

import { mapAuthError } from './error-mapper';
import type {
  ResendVerificationVariables,
  VerifyEmailVariables,
} from './types';

/**
 * Verify email with OTP token
 *
 * Verifies the user's email address using a token from the verification email.
 * Updates the auth store with verified status on success.
 *
 * @example
 * const verifyEmail = useVerifyEmail();
 * await verifyEmail.mutateAsync({
 *   tokenHash: 'abc123...',
 *   type: 'signup'
 * });
 */
export const useVerifyEmail = createMutation<void, VerifyEmailVariables, Error>(
  {
    mutationKey: ['auth', 'verify-email'],
    mutationFn: async (variables: VerifyEmailVariables): Promise<void> => {
      const { tokenHash, type } = variables;

      const { error } = await supabase.auth.verifyOtp({
        type,
        token_hash: tokenHash,
      });

      if (error) {
        throw new Error(mapAuthError(error));
      }

      // Update user state to mark email as verified
      const user = useAuth.getState().user;
      if (user) {
        useAuth.getState().updateUser({
          ...user,
          email_confirmed_at: new Date().toISOString(),
        });
      }
    },
    onSuccess: async (_, variables) => {
      // Track analytics event with consent checking and PII sanitization
      await trackAuthEvent('auth.email_verified', {
        type: variables.type,
        email: useAuth.getState().user?.email,
        user_id: useAuth.getState().user?.id,
      });
    },
    onError: async (error: Error, variables) => {
      await logAuthError(error, {
        errorKey: error.message,
        flow: 'email_verify',
        type: variables.type,
      });
    },
  }
);

/**
 * Resend verification email
 *
 * Sends a new verification email to the user. Useful when the original
 * email was not received or has expired.
 *
 * @example
 * const resendEmail = useResendVerificationEmail();
 * await resendEmail.mutateAsync({ email: 'user@example.com' });
 */
export const useResendVerificationEmail = createMutation<
  void,
  ResendVerificationVariables,
  Error
>({
  mutationKey: ['auth', 'resend-verification'],
  mutationFn: async (variables: ResendVerificationVariables): Promise<void> => {
    const { email } = variables;

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    });

    if (error) {
      throw new Error(mapAuthError(error));
    }
  },
  onSuccess: async (_, variables) => {
    // Track analytics event with consent checking and PII sanitization
    await trackAuthEvent('auth.email_verification_resent', {
      email: variables.email,
    });
  },
  onError: async (error: Error, variables) => {
    await logAuthError(error, {
      errorKey: error.message,
      flow: 'email_resend',
      email: variables.email,
    });
  },
});
