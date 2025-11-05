import { Stack, useRouter } from 'expo-router';
import * as React from 'react';

import {
  ChangePasswordModal,
  useChangePasswordModal,
} from '@/components/auth/change-password-modal';
import { BiometricToggleSection } from '@/components/settings/biometric-toggle-section';
import { DangerZoneWarning } from '@/components/settings/danger-zone-warning';
import { Item } from '@/components/settings/item';
import { ItemsContainer } from '@/components/settings/items-container';
import { FocusAwareStatusBar, ScrollView, Text, View } from '@/components/ui';
import { Lock, Shield, Trash } from '@/components/ui/icons';
import { translate } from '@/lib';

export default function SecuritySettingsScreen(): JSX.Element {
  const router = useRouter();
  const { ref: changePasswordModalRef, present: presentChangePasswordModal } =
    useChangePasswordModal();

  const handleChangePassword = () => {
    presentChangePasswordModal();
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
              testID="change-password-item"
            />
          </ItemsContainer>

          {/* Biometric Section */}
          <BiometricToggleSection />

          {/* MFA Section */}
          <ItemsContainer title="auth.security.mfa_section">
            <Item
              text="auth.security.two_factor_auth"
              value={translate('auth.security.coming_soon')}
              icon={<Shield />}
              testID="two-factor-item"
            />
          </ItemsContainer>

          {/* Active Sessions Section */}
          <ItemsContainer title="auth.security.sessions_section">
            <Item
              text="auth.security.active_sessions"
              onPress={() => router.push('/settings/active-sessions')}
              testID="active-sessions-item"
            />
          </ItemsContainer>

          {/* Danger Zone */}
          <ItemsContainer title="auth.security.danger_zone">
            <Item
              text="auth.security.delete_account"
              icon={<Trash />}
              onPress={handleDeleteAccount}
              testID="delete-account-item"
            />
          </ItemsContainer>

          <DangerZoneWarning />
        </View>
      </ScrollView>

      {/* Change Password Modal */}
      <ChangePasswordModal ref={changePasswordModalRef} />
    </>
  );
}
