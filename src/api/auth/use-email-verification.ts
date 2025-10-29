/**
 * Email verification hooks
 *
 * Provides React Query mutations for email verification flows:
 * - Verify email with OTP token
 * - Resend verification email
 */

import { createMutation } from 'react-query-kit';

import { useAuth } from '@/lib/auth';
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
export const useVerifyEmail = createMutation({
  mutationKey: ['auth', 'verify-email'],
  mutationFn: async (variables: VerifyEmailVariables) => {
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

    // TODO: Task 7.3 - Add trackAuthEvent('email_verified') when analytics helper is implemented
  },
});

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
export const useResendVerificationEmail = createMutation({
  mutationKey: ['auth', 'resend-verification'],
  mutationFn: async (variables: ResendVerificationVariables) => {
    const { email } = variables;

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    });

    if (error) {
      throw new Error(mapAuthError(error));
    }
  },
});
