/**
 * Template List Item
 *
 * Displays a community template in a list
 */

import React from 'react';
import { Pressable } from 'react-native';

import type { CommunityTemplate } from '@/api/templates';
import { Text, View } from '@/components/ui';

interface TemplateListItemProps {
  template: CommunityTemplate;
  onPress: (template: CommunityTemplate) => void;
}

export const TemplateListItem = React.memo(function TemplateListItem({
  template,
  onPress,
}: TemplateListItemProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPress(template)}
      className="mb-3 rounded-lg bg-white p-4 active:bg-neutral-100 dark:bg-charcoal-900 dark:active:bg-charcoal-800"
    >
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="flex-1 text-lg font-semibold text-charcoal-900 dark:text-neutral-100">
          {template.name}
        </Text>
        <View className="ml-2 rounded-full bg-primary-100 px-2 py-1 dark:bg-primary-900">
          <Text className="text-xs font-medium text-primary-700 dark:text-primary-300">
            {template.setup.replace(/_/g, ' ').toUpperCase()}
          </Text>
        </View>
      </View>

      {template.description && (
        <Text
          className="mb-2 text-sm text-neutral-600 dark:text-neutral-400"
          numberOfLines={2}
        >
          {template.description}
        </Text>
      )}

      <View className="flex-row items-center gap-4">
        <View className="flex-row items-center">
          <Text className="text-xs text-neutral-600 dark:text-neutral-400">
            By {template.authorHandle}
          </Text>
        </View>

        <View className="flex-row items-center">
          <Text className="text-xs text-neutral-500 dark:text-neutral-400">
            📅 {template.totalWeeks || 0} weeks
          </Text>
        </View>

        <View className="flex-row items-center">
          <Text className="text-xs text-neutral-500 dark:text-neutral-400">
            ✓ {template.adoptionCount} adopted
          </Text>
        </View>

        {template.ratingAverage && (
          <View className="flex-row items-center">
            <Text className="text-xs text-neutral-500 dark:text-neutral-400">
              ⭐ {template.ratingAverage.toFixed(1)} ({template.ratingCount})
            </Text>
          </View>
        )}
      </View>

      <View className="mt-2 flex-row items-center">
        <View className="rounded border border-neutral-200 bg-white px-2 py-1 dark:border-charcoal-700 dark:bg-charcoal-900">
          <Text className="text-xs text-neutral-500 dark:text-neutral-400">
            {template.license}
          </Text>
        </View>
      </View>
    </Pressable>
  );
});

TemplateListItem.displayName = 'TemplateListItem';
