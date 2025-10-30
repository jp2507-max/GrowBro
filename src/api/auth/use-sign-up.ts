/**
 * React Query mutation hook for email/password sign up
 * Validates password requirements and sends verification email
 */

import { createMutation } from 'react-query-kit';
import { z } from 'zod';

import { logAuthError, trackAuthEvent } from '@/lib/auth/auth-telemetry';
import { supabase } from '@/lib/supabase';

import { mapAuthError } from './error-mapper';
import type { SignUpResponse, SignUpVariables } from './types';

/**
 * Password validation schema
 * Requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 */
const passwordSchema = z
  .string()
  .min(8, 'auth.error_password_too_short')
  .regex(/[A-Z]/, 'auth.error_password_no_uppercase')
  .regex(/[a-z]/, 'auth.error_password_no_lowercase')
  .regex(/[0-9]/, 'auth.error_password_no_number');

/**
 * Hook for signing up with email and password
 *
 * Requirements:
 * - 1.1: Create account and send verification email
 * - 1.4: Enforce password requirements
 * - 1.5: Store session tokens and update Zustand
 * - 11.1: Track analytics only if consented
 */
export const useSignUp = createMutation<SignUpResponse, SignUpVariables, Error>(
  {
    mutationFn: async (variables) => {
      const { email, password } = variables;

      // Validate password requirements
      const passwordValidation = passwordSchema.safeParse(password);
      if (!passwordValidation.success) {
        const firstError = passwordValidation.error.errors[0];
        throw new Error(firstError.message);
      }

      // Sign up with Supabase Auth
      // This will automatically send a verification email
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: 'growbro://verify-email',
        },
      });

      if (error) {
        const errorKey = mapAuthError(error);
        throw new Error(errorKey);
      }

      return {
        session: data.session,
        user: data.user,
      };
    },

    onSuccess: async (data, variables) => {
      // Track analytics event with consent checking and PII sanitization
      await trackAuthEvent('auth.sign_up', {
        method: 'email',
        email: variables.email,
        user_id: data.user?.id,
        email_verification_sent: !!data.user,
      });

      // Note: We don't call signIn here because the user needs to verify email first
      // The session will be established after email verification
      console.log('[Auth] Sign up successful - verification email sent');
    },

    onError: async (error: Error, variables) => {
      // Log error for debugging with consent checking
      await logAuthError(error, {
        errorKey: error.message,
        flow: 'sign_up',
        method: 'email',
        email: variables.email,
      });
    },
  }
);

/**
 * Validate password client-side before submitting
 * Useful for form validation feedback
 */
export function validatePassword(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const validation = passwordSchema.safeParse(password);

  if (validation.success) {
    return { isValid: true, errors: [] };
  }

  return {
    isValid: false,
    errors: validation.error.errors.map((err) => err.message),
  };
}
