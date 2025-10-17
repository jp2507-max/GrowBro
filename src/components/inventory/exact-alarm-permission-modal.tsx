/**
 * Exact Alarm Permission Modal
 *
 * Prompts users to grant SCHEDULE_EXACT_ALARM permission on Android 13+.
 * Explains benefits for low-stock notifications and provides fallback info.
 *
 * Requirements: 4.2
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Text, View } from '@/components/ui';
import {
  checkExactAlarmPermission,
  type ExactAlarmPermissionStatus,
  requestExactAlarmPermission,
} from '@/lib/permissions/exact-alarm';

type ExactAlarmPermissionModalProps = {
  visible: boolean;
  onDismiss: () => void;
  onPermissionGranted?: () => void;
};

export function ExactAlarmPermissionModal({
  visible,
  onDismiss,
  onPermissionGranted,
}: ExactAlarmPermissionModalProps): React.ReactElement | null {
  const { t } = useTranslation();
  const [isRequesting, setIsRequesting] = React.useState(false);

  const handleRequestPermission = React.useCallback(async () => {
    setIsRequesting(true);
    try {
      const status = await requestExactAlarmPermission();
      if (status === 'granted') {
        onPermissionGranted?.();
        onDismiss();
      } else {
        // Permission denied, close modal and let fallback banner show
        onDismiss();
      }
    } catch (error) {
      console.error('Failed to request exact alarm permission:', error);
    } finally {
      setIsRequesting(false);
    }
  }, [onDismiss, onPermissionGranted]);

  const handleDismiss = React.useCallback(() => {
    onDismiss();
  }, [onDismiss]);

  if (!visible) return null;

  return (
    <View
      className="absolute inset-0 z-50 items-center justify-center bg-black/50"
      testID="exact-alarm-permission-modal"
    >
      <View className="mx-4 max-w-md rounded-2xl bg-white p-6 dark:bg-charcoal-800">
        <Text className="mb-4 text-xl font-bold text-charcoal-950 dark:text-white">
          {t('inventory.permissions.exact_alarm_title')}
        </Text>

        <Text className="mb-4 text-base text-charcoal-700 dark:text-neutral-200">
          {t('inventory.permissions.exact_alarm_description')}
        </Text>

        <Text className="mb-6 text-sm text-charcoal-600 dark:text-neutral-300">
          {t('inventory.permissions.exact_alarm_benefits')}
        </Text>

        <View className="flex-row gap-3">
          <View className="flex-1">
            <Button
              onPress={handleDismiss}
              variant="outline"
              disabled={isRequesting}
            >
              {t('common.cancel')}
            </Button>
          </View>
          <View className="flex-1">
            <Button
              onPress={handleRequestPermission}
              variant="default"
              loading={isRequesting}
              disabled={isRequesting}
            >
              {t('inventory.permissions.grant_permission')}
            </Button>
          </View>
        </View>
      </View>
    </View>
  );
}

/**
 * Hook to manage exact alarm permission state
 */
export function useExactAlarmPermission() {
  const [status, setStatus] =
    React.useState<ExactAlarmPermissionStatus>('unknown');
  const [showModal, setShowModal] = React.useState(false);

  React.useEffect(() => {
    let isMounted = true;

    checkExactAlarmPermission()
      .then((result) => {
        if (isMounted) {
          setStatus(result);
        }
      })
      .catch((error) => {
        console.error('Failed to check exact alarm permission:', error);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const openPermissionModal = React.useCallback(() => {
    setShowModal(true);
  }, []);

  const closePermissionModal = React.useCallback(() => {
    setShowModal(false);
  }, []);

  const refreshPermissionStatus = React.useCallback(async () => {
    const newStatus = await checkExactAlarmPermission();
    setStatus(newStatus);
    return newStatus;
  }, []);

  return {
    status,
    showModal,
    openPermissionModal,
    closePermissionModal,
    refreshPermissionStatus,
  };
}
