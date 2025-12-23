/**
 * ProfileHeader component
 *
 * Displays user profile summary with avatar, display name, and key statistics
 * in the settings hub. Requirements: 9.1, 10.1, 10.2
 */

import { useRouter } from 'expo-router';
import React from 'react';

import { translate } from '@/lib';
import type { ProfileStatistics } from '@/types/settings';

import { Image, Pressable, Text, View } from '../ui';

interface ProfileHeaderProps {
  displayName?: string;
  avatarUrl?: string;
  statistics?: ProfileStatistics;
  isLoading?: boolean;
  testID?: string;
}

// eslint-disable-next-line max-lines-per-function -- Presentational header component
export function ProfileHeader({
  displayName,
  avatarUrl,
  statistics,
  isLoading = false,
  testID = 'profile-header',
}: ProfileHeaderProps): React.ReactElement {
  const router = useRouter();

  const handlePress = () => {
    router.push('/settings/profile');
  };

  if (isLoading) {
    return (
      <View className="px-4 py-3" testID={`${testID}-loading`}>
        <View className="flex-row items-center gap-4">
          <View className="size-16 rounded-full bg-neutral-200 dark:bg-neutral-700" />
          <View className="flex-1 gap-2">
            <View className="h-5 w-32 rounded bg-neutral-200 dark:bg-neutral-700" />
            <View className="h-4 w-48 rounded bg-neutral-200 dark:bg-neutral-700" />
          </View>
        </View>
      </View>
    );
  }

  const initials = displayName
    ? displayName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={handlePress}
      className="px-4 py-3 active:opacity-70"
      testID={testID}
    >
      <View className="flex-row items-center gap-4">
        {avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            className="size-16 rounded-full"
            contentFit="cover"
            testID={`${testID}-avatar`}
          />
        ) : (
          <View
            className="size-16 items-center justify-center rounded-full bg-primary-200 dark:bg-primary-800"
            testID={`${testID}-avatar-placeholder`}
          >
            <Text className="text-2xl font-bold text-primary-700 dark:text-primary-300">
              {initials}
            </Text>
          </View>
        )}

        <View className="flex-1">
          <Text
            className="text-lg font-semibold text-charcoal-900 dark:text-neutral-100"
            testID={`${testID}-display-name`}
          >
            {displayName || translate('profile.setProfilePrompt')}
          </Text>

          {statistics && (
            <View className="mt-1 flex-row gap-4" testID={`${testID}-stats`}>
              <Text className="text-sm text-neutral-600 dark:text-neutral-400">
                {statistics.plantsCount === 0
                  ? translate('profile.statistics.plantsCount_zero', {
                      count: statistics.plantsCount,
                    })
                  : statistics.plantsCount === 1
                    ? translate('profile.statistics.plantsCount_one', {
                        count: statistics.plantsCount,
                      })
                    : translate('profile.statistics.plantsCount_other', {
                        count: statistics.plantsCount,
                      })}
              </Text>
              <Text className="text-sm text-neutral-600 dark:text-neutral-400">
                {statistics.harvestsCount === 0
                  ? translate('profile.statistics.harvestsCount_zero', {
                      count: statistics.harvestsCount,
                    })
                  : statistics.harvestsCount === 1
                    ? translate('profile.statistics.harvestsCount_one', {
                        count: statistics.harvestsCount,
                      })
                    : translate('profile.statistics.harvestsCount_other', {
                        count: statistics.harvestsCount,
                      })}
              </Text>
              <Text className="text-text-secondary text-sm">
                {statistics.postsCount === 0
                  ? translate('profile.statistics.postsCount_zero', {
                      count: statistics.postsCount,
                    })
                  : statistics.postsCount === 1
                    ? translate('profile.statistics.postsCount_one', {
                        count: statistics.postsCount,
                      })
                    : translate('profile.statistics.postsCount_other', {
                        count: statistics.postsCount,
                      })}
              </Text>
            </View>
          )}
        </View>

        {/* Chevron indicator */}
        <View className="ml-auto">
          <Text className="text-text-secondary">
            {translate('profile.chevron')}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
