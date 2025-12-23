/**
 * Profile statistics display component
 * Requirements: 10.1, 10.2, 10.3
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable } from 'react-native';

import { Text, View } from '@/components/ui';

interface ProfileStatisticsProps {
  plantsCount: number;
  harvestsCount: number;
  postsCount: number;
  likesReceived: number;
  isLoading: boolean;
  isSyncing: boolean;
  onPlantsPress: () => void;
  onHarvestsPress: () => void;
}

export function ProfileStatistics({
  plantsCount,
  harvestsCount,
  postsCount,
  likesReceived,
  isLoading,
  isSyncing,
  onPlantsPress,
  onHarvestsPress,
}: ProfileStatisticsProps) {
  const { t } = useTranslation();

  return (
    <View className="my-4">
      <Text className="mb-2 text-lg font-semibold text-charcoal-900 dark:text-neutral-100">
        {t('profile.statistics.title')}
      </Text>

      {isLoading ? (
        <ActivityIndicator />
      ) : (
        <View className="flex-row flex-wrap gap-3">
          <Pressable
            accessibilityRole="button"
            className="flex-1 rounded-xl bg-white p-4 dark:bg-charcoal-900"
            onPress={onPlantsPress}
          >
            <Text className="text-2xl font-bold text-primary-600">
              {plantsCount}
            </Text>
            <Text className="text-sm text-neutral-600 dark:text-neutral-400">
              {t('profile.statistics.plants')}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            className="bg-card flex-1 rounded-xl p-4"
            onPress={onHarvestsPress}
          >
            <Text className="text-2xl font-bold text-primary-600">
              {harvestsCount}
            </Text>
            <Text className="text-sm text-neutral-600 dark:text-neutral-400">
              {t('profile.statistics.harvests')}
            </Text>
          </Pressable>

          <View className="bg-card flex-1 rounded-xl p-4">
            <Text className="text-2xl font-bold text-primary-600">
              {postsCount}
            </Text>
            <Text className="text-text-secondary text-sm">
              {t('profile.statistics.posts')}
            </Text>
          </View>

          <View className="bg-card flex-1 rounded-xl p-4">
            <Text className="text-2xl font-bold text-primary-600">
              {likesReceived}
            </Text>
            <Text className="text-text-secondary text-sm">
              {t('profile.statistics.likes')}
            </Text>
          </View>
        </View>
      )}

      {isSyncing && (
        <Text className="text-text-secondary mt-2 text-xs">
          {t('profile.statistics.syncing')}
        </Text>
      )}
    </View>
  );
}
