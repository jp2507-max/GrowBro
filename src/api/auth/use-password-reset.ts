/**
 * Password reset hooks
 *
 * Provides React Query mutations for password reset flows:
 * - Request password reset email
 * - Confirm password reset with token
 */

import { createMutation } from 'react-query-kit';

import { logAuthError, trackAuthEvent } from '@/lib/auth/auth-telemetry';
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
  onSuccess: async (_, variables) => {
    // Track analytics event with consent checking and PII sanitization
    await trackAuthEvent('auth.password_reset_requested', {
      email: variables.email,
    });
  },
  onError: async (error: Error, variables) => {
    await logAuthError(error, {
      errorKey: error.message,
      flow: 'password_reset_request',
      email: variables.email,
    });
  },
});

/**
 * Confirm password reset with new password
 *
 * Supports two flows:
 * 1. Token-based: When tokenHash is provided, verifies OTP first then updates password
 * 2. Session-based: When tokenHash is not provided, assumes session is already established and just updates password
 *
 * @example
 * // Token-based flow (traditional)
 * const confirmReset = useConfirmPasswordReset();
 * await confirmReset.mutateAsync({
 *   tokenHash: 'abc123...',
 *   newPassword: 'NewSecure123!'
 * });
 *
 * // Session-based flow (when session already established)
 * const confirmReset = useConfirmPasswordReset();
 * await confirmReset.mutateAsync({
 *   newPassword: 'NewSecure123!'
 * });
 */
export const useConfirmPasswordReset = createMutation({
  mutationKey: ['auth', 'confirm-password-reset'],
  mutationFn: async (variables: ConfirmPasswordResetVariables) => {
    const { tokenHash, newPassword } = variables;

    // If tokenHash is provided, verify OTP to establish session first
    if (tokenHash) {
      // Step 1: Verify OTP to establish temporary session
      const { error: verifyError } = await supabase.auth.verifyOtp({
        type: 'recovery',
        token_hash: tokenHash,
      });

      if (verifyError) {
        throw new Error(mapAuthError(verifyError));
      }
    }

    // Step 2: Update password (session should be established either way)
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      throw new Error(mapAuthError(updateError));
    }

    // Session is now established with new password
    // Auth state will be updated via onAuthStateChange listener
  },
  onSuccess: async (_, variables) => {
    // Track analytics event with consent checking and PII sanitization
    await trackAuthEvent('auth.password_reset_completed', {
      has_token: !!variables.tokenHash,
    });
  },
  onError: async (error: Error, variables) => {
    await logAuthError(error, {
      errorKey: error.message,
      flow: 'password_reset_confirm',
      has_token: !!variables.tokenHash,
    });
  },
});
