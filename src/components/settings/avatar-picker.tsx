/**
 * Avatar picker component for profile screen
 * Requirements: 9.4, 9.5, 9.9
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable } from 'react-native';

import { Image, Text, View } from '@/components/ui';

interface AvatarPickerProps {
  avatarUrl: string | null;
  avatarStatus: 'idle' | 'uploading' | 'pending' | 'failed';
  uploadProgress: number;
  onPress: () => void;
}

export function AvatarPicker({
  avatarUrl,
  avatarStatus,
  uploadProgress,
  onPress,
}: AvatarPickerProps) {
  const { t } = useTranslation();

  return (
    <View className="mb-6 items-center">
      <Pressable accessibilityRole="button" onPress={onPress}>
        {avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            className="size-24 rounded-full"
            accessibilityLabel={t('profile.avatar.label')}
            accessibilityHint={t('profile.avatar.tap_to_change')}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View className="size-24 items-center justify-center rounded-full bg-neutral-200 dark:bg-neutral-700">
            <Text className="text-3xl font-bold text-neutral-600 dark:text-neutral-400">
              {t('profile.avatar.placeholder')}
            </Text>
          </View>
        )}
        {avatarStatus === 'uploading' && (
          <View className="absolute inset-0 items-center justify-center rounded-full bg-black/50">
            <ActivityIndicator color="white" />
            <Text className="mt-1 text-xs text-white">{uploadProgress}%</Text>
          </View>
        )}
      </Pressable>
      <Text className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        {t('profile.avatar.tap_to_change')}
      </Text>
    </View>
  );
}
