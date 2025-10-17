import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import React, { forwardRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { Button, Modal, Text, View } from '@/components/ui';
import { ExactAlarmCoordinator } from '@/lib/inventory/notifications/exact-alarm-coordinator';

type ExactAlarmPermissionSheetProps = {
  onPermissionGranted?: () => void;
  onPermissionDenied?: () => void;
};

/**
 * Bottom sheet explaining Android 13+ exact alarm permission for inventory notifications.
 * Shows user-friendly rationale before requesting SCHEDULE_EXACT_ALARM permission.
 *
 * @see Requirements 4.2 (Android 13+ notification handling)
 */
export const ExactAlarmPermissionSheet = forwardRef<
  BottomSheetModal,
  ExactAlarmPermissionSheetProps
>(({ onPermissionGranted, onPermissionDenied }, ref) => {
  const { t } = useTranslation();

  const handleRequestPermission = useCallback(async () => {
    try {
      const granted = await ExactAlarmCoordinator.requestPermission();

      // Dismiss sheet
      if (typeof ref === 'object' && ref?.current) {
        ref.current.dismiss();
      }

      if (granted) {
        onPermissionGranted?.();
      } else {
        onPermissionDenied?.();
      }
    } catch (error) {
      console.error('Error requesting exact alarm permission:', error);
      Alert.alert(
        t('inventory.permissions.exactAlarm.errorTitle'),
        t('inventory.permissions.exactAlarm.errorMessage')
      );
    }
  }, [onPermissionGranted, onPermissionDenied, ref, t]);

  const handleDismiss = useCallback(() => {
    if (typeof ref === 'object' && ref?.current) {
      ref.current.dismiss();
    }
    onPermissionDenied?.();
  }, [onPermissionDenied, ref]);

  return (
    <Modal
      ref={ref}
      snapPoints={['65%']}
      title={t('inventory.permissions.exactAlarm.title')}
    >
      <BottomSheetScrollView contentContainerClassName="px-4 pb-6">
        <View className="gap-4">
          {/* Why we need this permission */}
          <View className="gap-2">
            <Text className="font-inter-semibold text-base text-charcoal-900 dark:text-neutral-100">
              {t('inventory.permissions.exactAlarm.whyNeededTitle')}
            </Text>
            <Text className="text-sm text-charcoal-700 dark:text-neutral-300">
              {t('inventory.permissions.exactAlarm.whyNeededBody')}
            </Text>
          </View>

          {/* What happens if denied */}
          <View className="gap-2">
            <Text className="font-inter-semibold text-base text-charcoal-900 dark:text-neutral-100">
              {t('inventory.permissions.exactAlarm.ifDeniedTitle')}
            </Text>
            <Text className="text-sm text-charcoal-700 dark:text-neutral-300">
              {t('inventory.permissions.exactAlarm.ifDeniedBody')}
            </Text>
          </View>

          {/* Action buttons */}
          <View className="mt-4 gap-3">
            <Button
              label={t('inventory.permissions.exactAlarm.grantButton')}
              onPress={handleRequestPermission}
              testID="exact-alarm-grant-button"
            />
            <Button
              label={t('common.notNow')}
              variant="outline"
              onPress={handleDismiss}
              testID="exact-alarm-dismiss-button"
            />
          </View>
        </View>
      </BottomSheetScrollView>
    </Modal>
  );
});

ExactAlarmPermissionSheet.displayName = 'ExactAlarmPermissionSheet';
