/**
 * RestoreAccountBanner Component
 * Requirements: 6.7, 6.9 - Display restore option during grace period
 *
 * Shows a prominent banner when user has a pending account deletion request.
 * Displays:
 * - Warning that account will be permanently deleted
 * - Days remaining in grace period
 * - "Cancel Deletion" button to restore account
 * - Dismissible (but reappears on next session)
 *
 * Usage:
 * - Rendered in main app layout when pending deletion detected
 * - Checks for pending deletion on app start/auth state change
 * - Auto-dismisses when deletion is successfully cancelled
 */

import React, { useState } from 'react';
import { Alert } from 'react-native';

import { useCancelAccountDeletion } from '@/api/auth';
import { Button, Text, View } from '@/components/ui';
import { translate } from '@/lib/i18n';

interface RestoreAccountBannerProps {
  daysRemaining: number;
  requestId: string; // Used for future enhancements, kept for consistency
  onDismiss?: () => void;
}

function useCancelDeletionHandler(onDismiss?: () => void) {
  const cancelDeletion = useCancelAccountDeletion();

  const handleCancelDeletion = () => {
    Alert.alert(
      translate('settings.delete_account.restore_banner.confirm_title'),
      translate('settings.delete_account.restore_banner.confirm_message'),
      [
        {
          text: translate('common.cancel'),
          style: 'cancel',
        },
        {
          text: translate(
            'settings.delete_account.restore_banner.confirm_button'
          ),
          style: 'default',
          onPress: async () => {
            try {
              await cancelDeletion.mutateAsync();
              Alert.alert(
                translate(
                  'settings.delete_account.restore_banner.success_title'
                ),
                translate(
                  'settings.delete_account.restore_banner.success_message'
                )
              );
              onDismiss?.();
            } catch {
              Alert.alert(
                translate('common.error'),
                translate('settings.delete_account.restore_banner.cancel_error')
              );
            }
          },
        },
      ]
    );
  };

  return { handleCancelDeletion, cancelDeletion };
}

export function RestoreAccountBanner({
  daysRemaining,
  onDismiss,
}: RestoreAccountBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const { handleCancelDeletion, cancelDeletion } =
    useCancelDeletionHandler(onDismiss);

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  // Don't render if dismissed
  if (isDismissed) {
    return null;
  }

  return (
    <View className="mx-4 my-2 rounded-lg border-2 border-warning-500 bg-warning-50 p-4 dark:border-warning-600 dark:bg-warning-950">
      {/* Warning Icon + Title */}
      <View className="mb-2 flex-row items-center">
        <Text className="mr-2 text-2xl">⚠️</Text>
        <Text className="flex-1 text-base font-semibold text-warning-900 dark:text-warning-100">
          {translate('settings.delete_account.restore_banner.title')}
        </Text>
        {/* Dismiss Button */}
        <Button
          variant="ghost"
          size="sm"
          onPress={handleDismiss}
          className="size-8 p-0"
          testID="restore-banner-dismiss"
        >
          <Text className="text-warning-700 dark:text-warning-300">✕</Text>
        </Button>
      </View>

      {/* Message */}
      <Text className="mb-3 text-sm text-warning-800 dark:text-warning-200">
        {translate('settings.delete_account.restore_banner.message', {
          days: daysRemaining,
        })}
      </Text>

      {/* Action Buttons */}
      <View className="flex-row gap-2">
        <Button
          variant="default"
          size="sm"
          onPress={handleCancelDeletion}
          loading={cancelDeletion.isPending}
          disabled={cancelDeletion.isPending}
          className="flex-1 bg-warning-600 dark:bg-warning-700"
          testID="restore-banner-cancel-deletion"
        >
          <Text className="font-semibold text-white">
            {translate('settings.delete_account.restore_banner.cancel_button')}
          </Text>
        </Button>
      </View>

      {/* Days Remaining Badge */}
      <View className="mt-3 flex-row items-center justify-center rounded-md bg-warning-100 py-2 dark:bg-warning-900">
        <Text className="text-xs font-medium text-warning-900 dark:text-warning-100">
          {translate('settings.delete_account.restore_banner.days_remaining', {
            days: daysRemaining,
          })}
        </Text>
      </View>
    </View>
  );
}
