import React, { useCallback, useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';

import {
  trackPrimerAccepted,
  trackPrimerShown,
} from '@/lib/compliance/onboarding-telemetry';
import { translate } from '@/lib/i18n';

import { Bell } from '../ui/icons';
import { AnimatedPrimerIcon } from './animated-primer-icon';
import { PermissionPrimerScreen } from './permission-primer-screen';

type NotificationPermissionPrimerProps = {
  onComplete: (granted: boolean) => void;
  testID?: string;
};

/**
 * Notification permission primer component
 * Explains the benefits of notifications before requesting permission
 *
 * Requirements:
 * - Privacy-First: explains before requesting (req 4.3)
 * - Core app remains fully usable without permission (design 4)
 * - Educational Focus: clear benefits (req 1.9)
 */
export function NotificationPermissionPrimer({
  onComplete,
  testID = 'notification-permission-primer',
}: NotificationPermissionPrimerProps): React.ReactElement {
  const [isLoading, setIsLoading] = useState(false);

  // Track primer shown on mount
  React.useEffect(() => {
    trackPrimerShown('notifications');
  }, []);

  const handleAllow = useCallback(async () => {
    setIsLoading(true);
    try {
      const { PermissionManager } = await import(
        '@/lib/permissions/permission-manager'
      );
      const result = await PermissionManager.requestNotificationPermission();
      const granted = result === 'granted';

      // Track permission result
      trackPrimerAccepted('notifications', granted);

      if (result === 'denied' && Platform.OS === 'ios') {
        // On iOS, if denied, guide user to settings
        Alert.alert(
          translate('onboarding.permissions.notifications.denied_title'),
          translate('onboarding.permissions.notifications.denied_message'),
          [
            {
              text: translate('common.cancel'),
              style: 'cancel',
              onPress: () => onComplete(false),
            },
            {
              text: translate('common.open_settings'),
              onPress: () => {
                Linking.openSettings();
                onComplete(false);
              },
            },
          ]
        );
      } else {
        onComplete(granted);
      }
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      onComplete(false);
    } finally {
      setIsLoading(false);
    }
  }, [onComplete]);

  const handleNotNow = useCallback(() => {
    // Track declined permission
    trackPrimerAccepted('notifications', false);
    onComplete(false);
  }, [onComplete]);

  const icon = (
    <AnimatedPrimerIcon
      icon={<Bell size={32} color="white" />}
      variant="primary"
    />
  );

  return (
    <PermissionPrimerScreen
      icon={icon}
      titleTx="onboarding.permissions.notifications.title"
      descriptionTx="onboarding.permissions.notifications.description"
      benefitsTx={[
        'onboarding.permissions.notifications.benefit1',
        'onboarding.permissions.notifications.benefit2',
        'onboarding.permissions.notifications.benefit3',
      ]}
      onAllow={handleAllow}
      onNotNow={handleNotNow}
      isLoading={isLoading}
      testID={testID}
    />
  );
}
