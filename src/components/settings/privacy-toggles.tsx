/**
 * Privacy toggles component for profile screen
 * Requirements: 9.8
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';

import { Text, View } from '@/components/ui';

interface PrivacyTogglesProps {
  showProfileToCommunity: boolean;
  allowDirectMessages: boolean;
  onToggleShowProfile: () => void;
  onToggleAllowDMs: () => void;
}

export function PrivacyToggles({
  showProfileToCommunity,
  allowDirectMessages,
  onToggleShowProfile,
  onToggleAllowDMs,
}: PrivacyTogglesProps) {
  const { t } = useTranslation();

  return (
    <View className="my-4">
      <Text className="mb-2 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
        {t('profile.privacy.title')}
      </Text>

      <Pressable
        accessibilityRole="button"
        className="mb-3 flex-row items-center justify-between rounded-xl bg-neutral-100 p-4 dark:bg-neutral-800"
        onPress={onToggleShowProfile}
      >
        <Text className="flex-1 text-neutral-900 dark:text-neutral-100">
          {t('profile.privacy.show_profile')}
        </Text>
        <View
          className={`size-6 rounded ${showProfileToCommunity ? 'bg-primary-600' : 'bg-neutral-300 dark:bg-neutral-600'}`}
        />
      </Pressable>

      <Pressable
        accessibilityRole="button"
        className="flex-row items-center justify-between rounded-xl bg-neutral-100 p-4 dark:bg-neutral-800"
        onPress={onToggleAllowDMs}
      >
        <Text className="flex-1 text-neutral-900 dark:text-neutral-100">
          {t('profile.privacy.allow_d_ms')}
        </Text>
        <View
          className={`size-6 rounded ${allowDirectMessages ? 'bg-primary-600' : 'bg-neutral-300 dark:bg-neutral-600'}`}
        />
      </Pressable>
    </View>
  );
}
