import { Stack, useRouter } from 'expo-router';
import * as React from 'react';
import { Alert } from 'react-native';

import { Item } from '@/components/settings/item';
import { ItemsContainer } from '@/components/settings/items-container';
import { FocusAwareStatusBar, ScrollView, Text, View } from '@/components/ui';
import { Lock, Shield, Trash } from '@/components/ui/icons';
import { translate } from '@/lib';

export default function SecuritySettingsScreen() {
  const router = useRouter();

  const handleChangePassword = () => {
    // TODO: Implement change password flow (future task)
    Alert.alert(
      translate('auth.security.change_password_title'),
      translate('auth.security.change_password_coming_soon')
    );
  };

  const handleDeleteAccount = () => {
    // Show confirmation dialog
    Alert.alert(
      translate('auth.security.delete_account_title'),
      translate('auth.security.delete_account_warning'),
      [
        {
          text: translate('common.cancel'),
          style: 'cancel',
        },
        {
          text: translate('auth.security.delete_account'),
          style: 'destructive',
          onPress: () => {
            // TODO: Implement delete account flow (future task)
            Alert.alert(
              translate('auth.security.delete_account_title'),
              translate('auth.security.delete_account_coming_soon')
            );
          },
        },
      ]
    );
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
    </>
  );
}
