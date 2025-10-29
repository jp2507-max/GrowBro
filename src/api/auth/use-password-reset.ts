/**
 * Password reset hooks
 *
 * Provides React Query mutations for password reset flows:
 * - Request password reset email
 * - Confirm password reset with token
 */

import { createMutation } from 'react-query-kit';

import { supabase } from '@/lib/supabase';

import { mapAuthError } from './error-mapper';
import type {
  ConfirmPasswordResetVariables,
  ResetPasswordVariables,
} from './types';

/**
 * Request password reset email
 *
 * Sends a password reset email to the user. Always returns success
 * to prevent email enumeration attacks.
 *
 * @example
 * const resetPassword = useResetPassword();
 * await resetPassword.mutateAsync({ email: 'user@example.com' });
 */
export const useResetPassword = createMutation({
  mutationKey: ['auth', 'reset-password'],
  mutationFn: async (variables: ResetPasswordVariables) => {
    const { email } = variables;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'growbro://reset-password',
    });

    // Note: Supabase always returns success even if email doesn't exist
    // This prevents email enumeration attacks
    if (error) {
      throw new Error(mapAuthError(error));
    }
  },
});

/**
 * Confirm password reset with new password
 *
 * Two-step process:
 * 1. Verify OTP token to establish temporary session
 * 2. Update password using temporary session
 *
 * @example
 * const confirmReset = useConfirmPasswordReset();
 * await confirmReset.mutateAsync({
 *   tokenHash: 'abc123...',
 *   newPassword: 'NewSecure123!'
 * });
 */
export const useConfirmPasswordReset = createMutation({
  mutationKey: ['auth', 'confirm-password-reset'],
  mutationFn: async (variables: ConfirmPasswordResetVariables) => {
    const { tokenHash, newPassword } = variables;

    // Step 1: Verify OTP to establish temporary session
    const { error: verifyError } = await supabase.auth.verifyOtp({
      type: 'recovery',
      token_hash: tokenHash,
    });

    if (verifyError) {
      throw new Error(mapAuthError(verifyError));
    }

    // Step 2: Update password while temporary session is active
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      throw new Error(mapAuthError(updateError));
    }

    // Session is now established with new password
    // Auth state will be updated via onAuthStateChange listener
  },
});
