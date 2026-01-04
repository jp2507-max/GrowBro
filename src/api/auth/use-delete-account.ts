/**
 * Account deletion hooks
 *
 * Provides React Query mutation for deleting user account with:
 * - Backend data cleanup via Edge Function
 * - Local WatermelonDB reset
 * - MMKV storage clear
 * - SecureStore cleanup
 * - File system photo deletion
 * - Global sign out
 *
 * GDPR compliant - permanent deletion with no data retention
 */

import { Directory, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import { createMutation } from 'react-query-kit';

import { useAuth } from '@/lib/auth';
import { clearAuthStorage } from '@/lib/auth/auth-storage';
import { logAuthError, trackAuthEvent } from '@/lib/auth/auth-telemetry';
import { supabase } from '@/lib/supabase';
import { database } from '@/lib/watermelon';

interface DeleteAccountResponse {
  success: boolean;
  deleted_counts?: Record<string, number>;
  error?: string;
}

/**
 * Delete user account permanently
 *
 * This is an irreversible operation that:
 * 1. Deletes all user data from Supabase (via Edge Function)
 * 2. Resets local WatermelonDB
 * 3. Clears MMKV storage
 * 4. Removes SecureStore keys
 * 5. Deletes local photos
 * 6. Signs out globally (revokes all sessions)
 *
 * Requirements:
 * - 10.1: Account deletion UI option
 * - 10.2: Confirmation dialog before deletion
 * - 10.3: Re-authentication required
 * - 10.4: Delete all Supabase data
 * - 10.5: Delete all local data
 * - 10.6: Sign out and redirect with confirmation
 *
 * @example
 * const deleteAccount = useDeleteAccount();
 * await deleteAccount.mutateAsync();
 */
export const useDeleteAccount = createMutation({
  mutationKey: ['auth', 'delete-account'],
  mutationFn: async () => {
    const currentUser = useAuth.getState().user;

    if (!currentUser) {
      throw new Error('auth.error_not_authenticated');
    }

    try {
      // Step 1: Delete backend data via Edge Function
      const { data, error } =
        await supabase.functions.invoke<DeleteAccountResponse>(
          'delete-account',
          {
            body: { user_id: currentUser.id },
          }
        );

      if (error) {
        console.error('Edge Function error:', error);
        throw new Error('Failed to delete account from server');
      }

      if (!data?.success) {
        console.error('Delete account failed:', data?.error);
        throw new Error(data?.error || 'Failed to delete account');
      }

      console.log('Backend deletion successful:', data.deleted_counts);

      // Step 2: Delete local data
      await deleteLocalData();

      // Step 3: Track analytics event before signing out (if consented)
      await trackAuthEvent('auth_account_deleted', {
        email: currentUser.email,
        user_id: currentUser.id,
        deleted_counts: data.deleted_counts,
      });

      // Step 4: Sign out globally (revokes all sessions)
      const { error: signOutError } = await supabase.auth.signOut({
        scope: 'global',
      });

      if (signOutError) {
        console.warn('Sign out error after deletion:', signOutError);
        // Don't throw - account is already deleted
      }

      // Step 5: Clear local auth state
      useAuth.getState().signOut();

      return { success: true };
    } catch (error) {
      console.error('Account deletion error:', error);
      throw error;
    }
  },
  onError: async (error: Error) => {
    // Log error for debugging with consent checking
    await logAuthError(error, {
      errorKey: error.message,
      flow: 'delete_account',
    });
  },
});

/**
 * Delete all local data
 * - WatermelonDB records
 * - MMKV storage
 * - SecureStore keys
 * - File system photos
 */
async function deleteLocalData(): Promise<void> {
  try {
    // 1. Reset WatermelonDB (deletes all local records)
    console.log('Resetting WatermelonDB...');
    await database.write(async () => {
      await database.unsafeResetDatabase();
    });
    console.log('WatermelonDB reset complete');

    // 2. Clear MMKV auth storage
    console.log('Clearing MMKV storage...');
    await clearAuthStorage();
    console.log('MMKV storage cleared');

    // 3. Clear SecureStore keys
    console.log('Clearing SecureStore...');
    const secureStoreKeys = [
      'auth-encryption-key',
      'privacy-consent.v1',
      'age-gate-verified',
    ];

    await Promise.allSettled(
      secureStoreKeys.map((key) => SecureStore.deleteItemAsync(key))
    );
    console.log('SecureStore cleared');

    // 4. Delete photos from file system
    console.log('Deleting local photos...');
    await deleteLocalPhotos();
    console.log('Local photos deleted');
  } catch (error) {
    console.error('Local data cleanup error:', error);
    // Log but don't throw - we want to continue with sign out
    await logAuthError(error as Error, {
      errorKey: 'local_cleanup_failed',
      flow: 'delete_account',
    });
  }
}

/**
 * Delete all photos from file system
 * Attempts to delete harvest-photos directory if it exists
 */
async function deleteLocalPhotos(): Promise<void> {
  try {
    const photoDir = new Directory(Paths.cache, 'harvest-photos');

    if (photoDir.exists) {
      await photoDir.delete();
      console.log('Photo directory deleted');
    } else {
      console.log('No photo directory to delete');
    }
  } catch (error) {
    console.warn('Failed to delete photo directory:', error);
    // Don't throw - this is not critical
  }
}
