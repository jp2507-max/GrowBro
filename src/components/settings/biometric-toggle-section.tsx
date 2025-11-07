import * as React from 'react';

import { ItemsContainer } from '@/components/settings/items-container';
import { Text, View } from '@/components/ui';
import { Switch } from '@/components/ui/checkbox';
import { Shield } from '@/components/ui/icons';
import {
  showErrorMessage,
  showSuccessMessage,
  translate,
  translateDynamic,
} from '@/lib';
import { useBiometricSettings } from '@/lib/auth/use-biometric-settings';

export function BiometricToggleSection() {
  const biometricSettings = useBiometricSettings();
  const { initialize } = biometricSettings;

  // Initialize biometric settings on mount
  React.useEffect(() => {
    void initialize();
  }, [initialize]);

  const handleToggleBiometric = async () => {
    if (biometricSettings.isEnabled) {
      // Disable biometric
      const result = await biometricSettings.disable();
      if (result.success) {
        showSuccessMessage(
          translate('auth.security.biometric_disabled_success')
        );
      } else {
        const translatedError = result.error
          ? translateDynamic(result.error)
          : null;
        showErrorMessage(
          translatedError ?? translate('auth.security.biometric_disable_error')
        );
      }
    } else {
      // Enable biometric
      const result = await biometricSettings.enable();
      if (result.success) {
        showSuccessMessage(
          translate('auth.security.biometric_enabled_success')
        );
      } else {
        const translatedError = result.error
          ? translateDynamic(result.error)
          : null;
        showErrorMessage(
          translatedError ?? translate('auth.security.biometric_enable_error')
        );
      }
    }
  };

  if (!biometricSettings.isAvailable) {
    return null;
  }

  return (
    <ItemsContainer title="auth.security.biometric_section">
      <View className="flex-row items-center justify-between px-4 py-2">
        <View className="flex-1 flex-row items-center">
          <View className="pr-2">
            <Shield />
          </View>
          <View className="flex-1">
            <Text>{translate('auth.security.biometric_login')}</Text>
            {biometricSettings.biometricType && (
              <Text className="text-xs text-neutral-500 dark:text-neutral-400">
                {biometricSettings.biometricType === 'face' &&
                  translate('settings.security.biometric.face')}
                {biometricSettings.biometricType === 'fingerprint' &&
                  translate('settings.security.biometric.fingerprint')}
                {biometricSettings.biometricType === 'iris' &&
                  translate('settings.security.biometric.iris')}
              </Text>
            )}
          </View>
        </View>
        <Switch
          value={biometricSettings.isEnabled}
          onValueChange={handleToggleBiometric}
          disabled={biometricSettings.isLoading}
          testID="biometric-toggle"
          accessibilityLabel="Toggle biometric login"
          accessibilityHint="Enable or disable biometric authentication for faster login"
        />
      </View>
    </ItemsContainer>
  );
}
