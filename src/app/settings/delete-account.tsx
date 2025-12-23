/**
 * Account Deletion Screen
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.10
 *
 * Provides GDPR-compliant account deletion with:
 * - Explanation of consequences
 * - Re-authentication requirement
 * - Final confirmation with "DELETE" text input
 * - 30-day grace period information
 * - Anonymous user handling
 *
 *
 */

import { Stack, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView } from 'react-native';
import { MMKV } from 'react-native-mmkv';

import { useRequestAccountDeletion } from '@/api/auth/use-request-account-deletion';
import { ReAuthModal, useReAuthModal } from '@/components/auth/re-auth-modal';
import {
  Button,
  FocusAwareStatusBar,
  Input,
  Text,
  View,
} from '@/components/ui';
import { AlertCircle, Trash } from '@/components/ui/icons';
import { showErrorMessage, showSuccessMessage, useAuth } from '@/lib';
import { database } from '@/lib/watermelon';

/**
 * Clear all local data
 * Requirements: 6.6
 *
 * Local Data Clearing Strategy:
 * =============================
 *
 * This function executes three distinct cleanup operations to ensure
 * complete removal of user data from the device. Order matters due to
 * dependencies and potential failures.
 *
 * Step 1: WatermelonDB Reset
 * - Deletes all local database records (plants, tasks, harvests, etc.)
 * - Uses unsafeResetDatabase() to clear all tables atomically
 * - Wrapped in write transaction for consistency
 * - Critical: Must happen first as other steps may depend on auth state
 *
 * Step 2: MMKV Storage Clear
 * - Removes all key-value pairs from auth storage
 * - Includes tokens, preferences, cached settings
 * - Uses clearAll() for atomic operation
 *
 * Step 3: SecureStore Keys Deletion
 * - Removes sensitive keys from iOS Keychain / Android Keystore
 * - Keys cleared:
 *   - auth-encryption-key: Database encryption key
 *   - privacy-consent.v1: User consent records
 *   - age-gate-verified: Age verification status
 * - Uses Promise.allSettled to continue even if some keys don't exist
 *
 * Error Handling:
 * - Failures are logged but don't throw
 * - Sign out proceeds even if cleanup fails
 * - Rationale: User intent to delete takes priority
 *   - Worst case: some local data remains but account is gone
 *   - Better than blocking deletion due to cleanup errors
 *
 * Privacy Implications:
 * - This is immediate local deletion (Requirement 6.6)
 * - Backend deletion happens after grace period
 * - User cannot access app after this point
 * - Local data is not recoverable after this function
 *
 * @throws Never - Errors are caught and logged, function always completes
 */
async function clearLocalData(): Promise<void> {
  try {
    // 1. Reset WatermelonDB (most critical - contains all user content)
    await database.write(async () => {
      await database.unsafeResetDatabase();
    });

    // 2. Clear MMKV storage (auth state, preferences, cached settings)
    const mmkvStorage = new MMKV({ id: 'auth-storage' });
    mmkvStorage.clearAll();

    // 3. Clear SecureStore keys (sensitive credentials and encryption keys)
    const secureStoreKeys = [
      'auth-encryption-key',
      'privacy-consent.v1',
      'age-gate-verified',
    ];

    await Promise.allSettled(
      secureStoreKeys.map((key) => SecureStore.deleteItemAsync(key))
    );
  } catch (error) {
    console.error('Failed to clear local data:', error);
    // Don't throw - we want to continue with sign out even if cleanup fails
  }
}

type DeletionStep = 'explanation' | 'auth' | 'confirmation';

// eslint-disable-next-line max-lines-per-function -- Complex multi-step deletion flow
export default function DeleteAccountScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { ref: reAuthModalRef, present: presentReAuthModal } = useReAuthModal();

  const [currentStep, setCurrentStep] = useState<DeletionStep>('explanation');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const deleteKeyword = t('settings.delete_account.confirm_keyword').trim();

  const isAnonymous = !user;

  // Mutation for requesting account deletion with grace period
  // Requirements: 6.5, 6.6, 6.12
  //
  // Grace Period Deletion Flow:
  // ===========================
  //
  // Backend Processing:
  // 1. Creates deletion request record with requestId and scheduledFor timestamp
  // 2. scheduledFor = now + 30 days (configurable grace period)
  // 3. Marks request as 'pending' status
  // 4. Schedules background job for permanent deletion
  // 5. Returns success to client
  //
  // Client Processing (onSuccess):
  // 1. Clear all local data immediately (see clearLocalData)
  // 2. Sign out user (prevents further app access)
  // 3. Show success message with grace period info
  // 4. Navigate to login screen
  //
  // Grace Period Mechanics:
  // - User can cancel deletion by logging in within 30 days
  // - Login checks for pending deletion and shows "Restore Account" banner
  // - Restore cancels deletion request and resumes normal access
  // - After 30 days, backend cascade job executes permanent deletion:
  //   - Deletes from Supabase tables (profiles, plants, harvests, etc.)
  //   - Deletes from blob storage (avatars, photos)
  //   - Notifies third-party processors (analytics, crash reporting)
  //   - Creates audit log entry
  //   - Sends confirmation email
  //
  // Rate Limiting:
  // - Server enforces 1 pending request per user (Requirement 6.11)
  // - Rejects new requests while status = 'pending' AND scheduledFor > now
  //
  // Error Handling:
  // - Server errors trigger toast notification
  // - User remains on confirmation screen for retry
  // - Local data not cleared until backend confirms success
  const requestDeletion = useRequestAccountDeletion({
    onSuccess: async (_data) => {
      // Clear local data and sign out
      await clearLocalData();
      await signOut();

      showSuccessMessage(
        t('settings.delete_account.scheduled_success', { days: 30 })
      );
      router.replace('/login');
    },
    onError: (error) => {
      showErrorMessage(
        t(error.message) || t('settings.delete_account.error_generic')
      );
    },
  });

  // Handle anonymous user deletion (Requirement 6.10)
  // Anonymous users don't have backend accounts, so we only clear local data
  // No grace period or backend deletion needed
  const handleAnonymousDelete = async () => {
    Alert.alert(
      t('settings.delete_account.anonymous_title'),
      t('settings.delete_account.anonymous_message'),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('common.confirm'),
          style: 'destructive',
          onPress: async () => {
            try {
              await clearLocalData();
              showSuccessMessage(
                t('settings.delete_account.anonymous_success')
              );
              router.replace('/login');
            } catch {
              showErrorMessage(t('settings.delete_account.error_generic'));
            }
          },
        },
      ]
    );
  };

  // Handle authenticated user deletion - step 1: explanation (Requirement 6.1)
  // Shows consequences and grace period information
  const handleContinueToAuth = () => {
    setCurrentStep('auth');
    presentReAuthModal();
  };

  // Handle re-authentication success - step 2: auth (Requirement 6.3)
  // Prevents accidental deletion by requiring password/biometric verification
  const handleReAuthSuccess = () => {
    setCurrentStep('confirmation');
  };

  // Handle final deletion - step 3: confirmation (Requirement 6.4)
  //
  // Final Confirmation Safeguard:
  // ============================
  //
  // Text Input Validation:
  // - User must type "DELETE" (case-insensitive) to proceed
  // - Button disabled until valid input entered
  // - Prevents accidental confirmation from muscle memory taps
  //
  // Double Confirmation:
  // - Native Alert shown after valid text input
  // - Provides one final chance to cancel
  // - Alert emphasizes 30-day grace period and permanence
  //
  // Flow on Confirm:
  // 1. Trigger requestDeletion mutation
  // 2. Backend creates deletion request (scheduledFor = now + 30 days)
  // 3. onSuccess: clearLocalData() + signOut() + navigate to login
  // 4. User sees success message with grace period info
  //
  // Audit Trail:
  // - Backend logs requestId, userId, requestedAt, policyVersion
  // - Deletion request stored in account_deletion_requests table
  // - Status: 'pending' until grace period expires or user restores
  //
  // Cancellation Options:
  // - User can cancel in this alert
  // - User can restore account by logging in within 30 days
  // - After 30 days, deletion is permanent and cannot be undone
  const handleConfirmDeletion = async () => {
    if (
      deleteConfirmText.trim().toLowerCase() !== deleteKeyword.toLowerCase()
    ) {
      return;
    }

    Alert.alert(
      t('settings.delete_account.final_confirm_title'),
      t('settings.delete_account.final_confirm_message'),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('settings.delete_account.confirm_action'),
          style: 'destructive',
          onPress: () => requestDeletion.mutate({}),
        },
      ]
    );
  };

  const isDeleteConfirmValid =
    deleteConfirmText.trim().toLowerCase() === deleteKeyword.toLowerCase();

  return (
    <>
      <Stack.Screen
        options={{
          title: t('settings.delete_account.title'),
          headerBackVisible: currentStep === 'explanation',
        }}
      />
      <FocusAwareStatusBar />

      <ScrollView className="flex-1 bg-neutral-50 dark:bg-charcoal-950">
        <View className="p-4">
          {/* Anonymous User Flow */}
          {isAnonymous && (
            <View>
              <ExplanationSection />
              <View className="mt-6">
                <Button
                  label={t('settings.delete_account.delete_local_data')}
                  onPress={handleAnonymousDelete}
                  loading={false}
                  disabled={false}
                  variant="outline"
                  className="border-danger-600"
                  textClassName="text-danger-600"
                />
                <Button
                  label={t('common.cancel')}
                  onPress={() => router.back()}
                  variant="ghost"
                  className="mt-3"
                />
              </View>
            </View>
          )}

          {/* Authenticated User Flow */}
          {!isAnonymous && (
            <>
              {currentStep === 'explanation' && (
                <View>
                  <ExplanationSection />
                  <View className="mt-6">
                    <Button
                      label={t('common.continue')}
                      onPress={handleContinueToAuth}
                      variant="outline"
                      className="border-danger-600"
                      textClassName="text-danger-600"
                    />
                    <Button
                      label={t('common.cancel')}
                      onPress={() => router.back()}
                      variant="ghost"
                      className="mt-3"
                    />
                  </View>
                </View>
              )}

              {currentStep === 'confirmation' && (
                <View>
                  <FinalConfirmationSection
                    deleteConfirmText={deleteConfirmText}
                    onChangeText={setDeleteConfirmText}
                    isValid={isDeleteConfirmValid}
                    onConfirm={handleConfirmDeletion}
                    onCancel={() => router.back()}
                    isDeleting={requestDeletion.isPending}
                    deleteKeyword={deleteKeyword}
                  />
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* Re-authentication Modal */}
      <ReAuthModal
        ref={reAuthModalRef}
        onSuccess={handleReAuthSuccess}
        onCancel={() => setCurrentStep('explanation')}
        title={t('settings.delete_account.reauth_title')}
        description={t('settings.delete_account.reauth_description')}
      />
    </>
  );
}

/**
 * Explanation Section Component
 * Shows consequences and what will be deleted
 * Requirements: 6.1, 6.2
 */
function ExplanationSection() {
  const { t } = useTranslation();

  const consequences = [
    'settings.delete_account.consequence_permanent',
    'settings.delete_account.consequence_irreversible',
    'settings.delete_account.consequence_grace_period',
  ];

  const dataToDelete = [
    'settings.delete_account.data_profile',
    'settings.delete_account.data_plants',
    'settings.delete_account.data_tasks',
    'settings.delete_account.data_harvests',
    'settings.delete_account.data_posts',
    'settings.delete_account.data_media',
    'settings.delete_account.data_all',
  ];

  return (
    <>
      {/* Warning Banner */}
      <View className="mb-6 rounded-lg bg-danger-50 p-4 dark:bg-danger-900/20">
        <View className="mb-3 flex-row items-center gap-3">
          <AlertCircle size={24} className="text-danger-600" />
          <Text className="flex-1 text-lg font-semibold text-danger-900 dark:text-danger-100">
            {t('settings.delete_account.warning_title')}
          </Text>
        </View>
        <Text className="text-base leading-6 text-danger-800 dark:text-danger-200">
          {t('settings.delete_account.warning_message')}
        </Text>
      </View>

      {/* Consequences */}
      <View className="mb-6">
        <Text className="mb-3 text-lg font-semibold text-charcoal-900 dark:text-neutral-100">
          {t('settings.delete_account.consequences_title')}
        </Text>
        {consequences.map((key, index) => (
          <View key={index} className="mb-3 flex-row gap-3">
            <AlertCircle size={20} color="#dc2626" />
            <Text className="flex-1 text-base leading-6 text-neutral-600 dark:text-neutral-400">
              {t(key)}
            </Text>
          </View>
        ))}
      </View>

      {/* What Will Be Deleted */}
      <View className="mb-6">
        <Text className="text-text-primary mb-3 text-lg font-semibold">
          {t('settings.delete_account.data_title')}
        </Text>
        {dataToDelete.map((key, index) => (
          <View key={index} className="mb-2 flex-row gap-3">
            <Trash size={18} color="#6b7280" />
            <Text className="flex-1 text-base text-neutral-600 dark:text-neutral-400">
              {t(key)}
            </Text>
          </View>
        ))}
      </View>

      {/* Grace Period Info */}
      <View className="rounded-lg bg-primary-50 p-4 dark:bg-primary-900/20">
        <Text className="mb-2 text-base font-semibold text-primary-900 dark:text-primary-100">
          {t('settings.delete_account.grace_period_title')}
        </Text>
        <Text className="text-base leading-6 text-primary-800 dark:text-primary-200">
          {t('settings.delete_account.grace_period_message')}
        </Text>
      </View>
    </>
  );
}

/**
 * Final Confirmation Section Component
 * Requires typing "DELETE" to confirm
 * Requirements: 6.4
 */
interface FinalConfirmationSectionProps {
  deleteConfirmText: string;
  onChangeText: (text: string) => void;
  isValid: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
  deleteKeyword: string;
}

function FinalConfirmationSection({
  deleteConfirmText,
  onChangeText,
  isValid,
  onConfirm,
  onCancel,
  isDeleting,
  deleteKeyword,
}: FinalConfirmationSectionProps) {
  const { t } = useTranslation();

  return (
    <>
      {/* Final Warning */}
      <View className="mb-6 rounded-lg bg-danger-50 p-4 dark:bg-danger-900/20">
        <View className="mb-3 flex-row items-center gap-3">
          <AlertCircle size={24} className="text-danger-600" />
          <Text className="flex-1 text-lg font-semibold text-danger-900 dark:text-danger-100">
            {t('settings.delete_account.final_warning_title')}
          </Text>
        </View>
        <Text className="text-base leading-6 text-danger-800 dark:text-danger-200">
          {t('settings.delete_account.final_warning_message')}
        </Text>
      </View>

      {/* Countdown Info */}
      <View className="mb-6 rounded-lg bg-white p-4 dark:bg-charcoal-900">
        <Text className="text-text-primary text-center text-lg font-semibold">
          {t('settings.delete_account.countdown_message', { days: 30 })}
        </Text>
      </View>

      {/* Type DELETE Confirmation */}
      <View className="mb-6">
        <Text className="text-text-secondary mb-3 text-base">
          {t('settings.delete_account.type_delete_instruction', {
            keyword: deleteKeyword,
          })}
        </Text>
        <View className="relative">
          <Input
            placeholder={deleteKeyword}
            value={deleteConfirmText}
            onChangeText={onChangeText}
            className="font-mono text-lg"
            autoCapitalize="characters"
            autoCorrect={false}
            testID="delete-confirm-input"
          />
          {isValid && (
            <View className="absolute right-3 top-3">
              <Text className="text-2xl">✓</Text>
            </View>
          )}
        </View>
      </View>

      {/* Action Buttons */}
      <View>
        <Button
          label={t('settings.delete_account.confirm_action')}
          onPress={onConfirm}
          loading={isDeleting}
          disabled={!isValid || isDeleting}
          variant="outline"
          className="border-danger-600"
          textClassName="text-danger-600"
          testID="confirm-delete-button"
        />
        <Button
          label={t('common.cancel')}
          onPress={onCancel}
          variant="ghost"
          className="mt-3"
          disabled={isDeleting}
        />
      </View>
    </>
  );
}
