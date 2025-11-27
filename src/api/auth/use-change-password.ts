/**
 * Password change hooks
 *
 * Provides React Query mutation for changing password while authenticated.
 * Requires current password verification before allowing password change.
 */

import { createMutation } from 'react-query-kit';

import { logAuthError, trackAuthEvent } from '@/lib/auth/auth-telemetry';
import { supabase } from '@/lib/supabase';

import { mapAuthError } from './error-mapper';

export interface ChangePasswordVariables {
  currentPassword: string;
  newPassword: string;
}

/**
 * Change password for authenticated user
 *
 * Verifies current password, updates to new password, and invalidates other sessions.
 *
 * @example
 * const changePassword = useChangePassword();
 * await changePassword.mutateAsync({
 *   currentPassword: 'OldPass123!',
 *   newPassword: 'NewSecure456!'
 * });
 */
export const useChangePassword = createMutation({
  mutationKey: ['auth', 'change-password'],
  mutationFn: async (variables: ChangePasswordVariables) => {
    const { currentPassword, newPassword } = variables;

    // Step 1: Get current user's email
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.email) {
      throw new Error(mapAuthError(userError));
    }

    // Step 2: Verify current password by attempting to sign in
    // This ensures the user knows their current password
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (verifyError) {
      if (verifyError.message.includes('Invalid')) {
        throw new Error('auth.error.invalid_current_password');
      }
      throw new Error(mapAuthError(verifyError));
    }

    // Step 3: Update to new password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      throw new Error(mapAuthError(updateError));
    }

    // Step 4: Explicitly revoke other sessions for security
    await supabase.auth.signOut({ scope: 'others' });
  },
  onSuccess: async () => {
    // Track analytics event with consent checking
    await trackAuthEvent('auth_password_changed', {});
  },
  onError: async (error: Error) => {
    await logAuthError(error, {
      errorKey: error.message,
      flow: 'password_change',
    });
  },
});
