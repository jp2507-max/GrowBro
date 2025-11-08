/**
 * Template List Item Component
 *
 * Card displaying a feeding template in the list view.
 * Shows template name, medium, phase count, and custom badge.
 *
 * Requirements: 1.1, 1.2
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';

import { Text, View } from '@/components/ui';
import type { FeedingTemplate } from '@/lib/nutrient-engine/types';

interface TemplateListItemProps {
  template: FeedingTemplate;
  onPress: (template: FeedingTemplate) => void;
  testID?: string;
}

export const TemplateListItem = React.memo(function TemplateListItem({
  template,
  onPress,
  testID = 'template-list-item',
}: TemplateListItemProps) {
  const { t } = useTranslation();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPress(template)}
      className="mb-3 rounded-lg border border-neutral-200 bg-white p-4 active:bg-neutral-50 dark:border-charcoal-800 dark:bg-charcoal-900 dark:active:bg-charcoal-800"
      testID={`${testID}-${template.id}`}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <Text className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
            {template.name}
          </Text>
          <Text className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {t(`nutrient.medium.${template.medium}`)} • {template.phases.length}{' '}
            {template.phases.length === 1
              ? t('nutrient.phase')
              : t('nutrient.phases')}
          </Text>
        </View>

        {template.isCustom && (
          <View className="ml-2 rounded-full bg-primary-100 px-2 py-1 dark:bg-primary-900">
            <Text className="text-xs font-medium text-primary-700 dark:text-primary-300">
              {t('nutrient.custom')}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
});

TemplateListItem.displayName = 'TemplateListItem';
