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
 * eslint-disable-next-line max-lines-per-function -- Complex multi-step deletion flow
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
  ControlledInput,
  FocusAwareStatusBar,
  Text,
  View,
} from '@/components/ui';
import { AlertCircle, Trash } from '@/components/ui/icons';
import { showErrorMessage, showSuccessMessage, useAuth } from '@/lib';
import { database } from '@/lib/watermelon';

/**
 * Clear all local data
 * Requirements: 6.6
 */
async function clearLocalData(): Promise<void> {
  try {
    // 1. Reset WatermelonDB
    await database.write(async () => {
      await database.unsafeResetDatabase();
    });

    // 2. Clear MMKV storage
    const mmkvStorage = new MMKV({ id: 'auth-storage' });
    mmkvStorage.clearAll();

    // 3. Clear SecureStore keys
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

export default function DeleteAccountScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { ref: reAuthModalRef, present: presentReAuthModal } = useReAuthModal();

  const [currentStep, setCurrentStep] = useState<DeletionStep>('explanation');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const isAnonymous = !user;

  // Mutation for requesting account deletion
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

  // Handle anonymous user deletion
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

  // Handle authenticated user deletion - step 1: explanation
  const handleContinueToAuth = () => {
    setCurrentStep('auth');
    presentReAuthModal();
  };

  // Handle re-authentication success - step 2: auth
  const handleReAuthSuccess = () => {
    setCurrentStep('confirmation');
  };

  // Handle final deletion - step 3: confirmation
  const handleConfirmDeletion = async () => {
    if (deleteConfirmText.toLowerCase() !== 'delete') {
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

  const isDeleteConfirmValid = deleteConfirmText.toLowerCase() === 'delete';

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
        <Text className="mb-3 text-lg font-semibold text-charcoal-950 dark:text-neutral-100">
          {t('settings.delete_account.consequences_title')}
        </Text>
        {consequences.map((key, index) => (
          <View key={index} className="mb-3 flex-row gap-3">
            <AlertCircle size={20} color="#dc2626" />
            <Text className="flex-1 text-base leading-6 text-neutral-700 dark:text-neutral-300">
              {t(key)}
            </Text>
          </View>
        ))}
      </View>

      {/* What Will Be Deleted */}
      <View className="mb-6">
        <Text className="mb-3 text-lg font-semibold text-charcoal-950 dark:text-neutral-100">
          {t('settings.delete_account.data_title')}
        </Text>
        {dataToDelete.map((key, index) => (
          <View key={index} className="mb-2 flex-row gap-3">
            <Trash size={18} color="#6b7280" />
            <Text className="flex-1 text-base text-neutral-700 dark:text-neutral-300">
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
}

function FinalConfirmationSection({
  deleteConfirmText,
  onChangeText,
  isValid,
  onConfirm,
  onCancel,
  isDeleting,
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
      <View className="mb-6 rounded-lg bg-neutral-100 p-4 dark:bg-charcoal-800">
        <Text className="text-center text-lg font-semibold text-charcoal-950 dark:text-neutral-100">
          {t('settings.delete_account.countdown_message', { days: 30 })}
        </Text>
      </View>

      {/* Type DELETE Confirmation */}
      <View className="mb-6">
        <Text className="mb-3 text-base text-neutral-700 dark:text-neutral-300">
          {t('settings.delete_account.type_delete_instruction')}
        </Text>
        <View className="relative">
          <ControlledInput
            name="deleteConfirm"
            control={undefined as any}
            placeholder="DELETE"
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
