import React, { useCallback, useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';

import {
  trackPrimerAccepted,
  trackPrimerShown,
} from '@/lib/compliance/onboarding-telemetry';
import { translate } from '@/lib/i18n';

import { Camera } from '../ui/icons';
import { AnimatedPrimerIcon } from './animated-primer-icon';
import { PermissionPrimerScreen } from './permission-primer-screen';

type CameraPermissionPrimerProps = {
  onComplete: (granted: boolean) => void;
  testID?: string;
};

/**
 * Camera/Photo permission primer component
 * Explains photo usage before requesting permission
 *
 * Requirements:
 * - Privacy-First: explains PHPicker/camera usage (design 4)
 * - Optional: core app works without it (design 4)
 * - Educational Focus: clear usage explanation
 */
export function CameraPermissionPrimer({
  onComplete,
  testID = 'camera-permission-primer',
}: CameraPermissionPrimerProps): React.ReactElement {
  const [isLoading, setIsLoading] = useState(false);

  // Track primer shown on mount
  React.useEffect(() => {
    trackPrimerShown('camera');
  }, []);

  const handleAllow = useCallback(async () => {
    setIsLoading(true);
    try {
      // Import dynamically to avoid issues if not available
      const ImagePicker = await import('expo-image-picker');

      // Request camera permission
      const cameraResult = await ImagePicker.requestCameraPermissionsAsync();

      // Request media library permission (for PHPicker on iOS)
      const mediaResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      const granted = cameraResult.granted || mediaResult.granted;

      // Track permission result
      trackPrimerAccepted('camera', granted);

      if (!granted && (cameraResult.canAskAgain || mediaResult.canAskAgain)) {
        // Permission denied but can ask again
        onComplete(false);
      } else if (!granted) {
        // Permission permanently denied, guide to settings
        Alert.alert(
          translate('onboarding.permissions.camera.denied_title'),
          translate('onboarding.permissions.camera.denied_message'),
          [
            {
              text: translate('common.cancel'),
              style: 'cancel',
              onPress: () => onComplete(false),
            },
            {
              text: translate('common.open_settings'),
              onPress: () => {
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:');
                } else {
                  Linking.openSettings();
                }
                onComplete(false);
              },
            },
          ]
        );
      } else {
        onComplete(true);
      }
    } catch (error) {
      console.error('Failed to request camera permission:', error);
      onComplete(false);
    } finally {
      setIsLoading(false);
    }
  }, [onComplete]);

  const handleNotNow = useCallback(() => {
    // Track declined permission
    trackPrimerAccepted('camera', false);
    onComplete(false);
  }, [onComplete]);

  const icon = (
    <AnimatedPrimerIcon
      icon={<Camera size={32} color="white" />}
      variant="success"
    />
  );

  return (
    <PermissionPrimerScreen
      icon={icon}
      titleTx="onboarding.permissions.camera.title"
      descriptionTx="onboarding.permissions.camera.description"
      benefitsTx={[
        'onboarding.permissions.camera.benefit1',
        'onboarding.permissions.camera.benefit2',
        'onboarding.permissions.camera.benefit3',
      ]}
      onAllow={handleAllow}
      onNotNow={handleNotNow}
      isLoading={isLoading}
      testID={testID}
    />
  );
}
