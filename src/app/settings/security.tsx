import { Stack, useRouter } from 'expo-router';
import * as React from 'react';
import { Switch } from 'react-native';

import {
  ChangePasswordModal,
  useChangePasswordModal,
} from '@/components/auth/change-password-modal';
import { Item } from '@/components/settings/item';
import { ItemsContainer } from '@/components/settings/items-container';
import { FocusAwareStatusBar, ScrollView, Text, View } from '@/components/ui';
import { Lock, Shield, Trash } from '@/components/ui/icons';
import {
  showErrorMessage,
  showSuccessMessage,
  translate,
  translateDynamic,
} from '@/lib';
import { useBiometricSettings } from '@/lib/auth/use-biometric-settings';

export default function SecuritySettingsScreen() {
  const router = useRouter();
  const { ref: changePasswordModalRef, present: presentChangePasswordModal } =
    useChangePasswordModal();

  const biometricSettings = useBiometricSettings();

  // Initialize biometric settings on mount
  React.useEffect(() => {
    void biometricSettings.initialize();
  }, [biometricSettings]);

  const handleChangePassword = () => {
    presentChangePasswordModal();
  };

  const handleToggleBiometric = async () => {
    if (biometricSettings.isEnabled) {
      // Disable biometric
      const success = await biometricSettings.disable();
      if (success) {
        showSuccessMessage(
          translate('auth.security.biometric_disabled_success')
        );
      } else if (biometricSettings.error) {
        const translatedError = translateDynamic(biometricSettings.error);
        showErrorMessage(
          translatedError ?? translate('auth.security.biometric_disable_error')
        );
      }
    } else {
      // Enable biometric
      const success = await biometricSettings.enable();
      if (success) {
        showSuccessMessage(
          translate('auth.security.biometric_enabled_success')
        );
      } else if (biometricSettings.error) {
        const translatedError = translateDynamic(biometricSettings.error);
        showErrorMessage(
          translatedError ?? translate('auth.security.biometric_enable_error')
        );
      }
    }
  };

  const handleDeleteAccount = () => {
    // Navigate to dedicated delete account screen
    router.push('/settings/delete-account');
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: translate('auth.security.title'),
          headerBackTitle: translate('common.back'),
        }}
      />
      <FocusAwareStatusBar />

      <ScrollView className="flex-1 bg-white dark:bg-charcoal-950">
        <View className="px-4 py-6">
          <Text className="mb-2 text-xl font-bold">
            {translate('auth.security.title')}
          </Text>
          <Text className="mb-4 text-neutral-600 dark:text-neutral-400">
            {translate('auth.security.description')}
          </Text>

          {/* Password Section */}
          <ItemsContainer title="auth.security.password_section">
            <Item
              text="auth.security.change_password"
              icon={<Lock />}
              onPress={handleChangePassword}
            />
          </ItemsContainer>

          {/* Biometric Section */}
          {biometricSettings.isAvailable && (
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
                          translate('settings.security.biometric.face' as any)}
                        {biometricSettings.biometricType === 'fingerprint' &&
                          translate(
                            'settings.security.biometric.fingerprint' as any
                          )}
                        {biometricSettings.biometricType === 'iris' &&
                          translate('settings.security.biometric.iris' as any)}
                      </Text>
                    )}
                  </View>
                </View>
                <Switch
                  value={biometricSettings.isEnabled}
                  onValueChange={handleToggleBiometric}
                  disabled={biometricSettings.isLoading}
                  testID="biometric-toggle"
                />
              </View>
            </ItemsContainer>
          )}

          {/* MFA Section */}
          <ItemsContainer title="auth.security.mfa_section">
            <Item
              text="auth.security.two_factor_auth"
              value={translate('auth.security.coming_soon')}
              icon={<Shield />}
            />
          </ItemsContainer>

          {/* Active Sessions Section */}
          <ItemsContainer title="auth.security.sessions_section">
            <Item
              text="auth.security.active_sessions"
              onPress={() => router.push('/settings/active-sessions')}
            />
          </ItemsContainer>

          {/* Danger Zone */}
          <ItemsContainer title="auth.security.danger_zone">
            <Item
              text="auth.security.delete_account"
              icon={<Trash />}
              onPress={handleDeleteAccount}
            />
          </ItemsContainer>

          <View className="mt-4 rounded-lg bg-warning-100 p-4 dark:bg-warning-900">
            <Text className="text-sm text-warning-900 dark:text-warning-100">
              {translate('auth.security.danger_zone_warning')}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Change Password Modal */}
      <ChangePasswordModal ref={changePasswordModalRef} />
    </>
  );
}
