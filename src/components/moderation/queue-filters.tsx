/**
 * Queue Filters Component
 * Filter controls for moderator queue (priority, category, SLA status)
 * Requirements: 2.1, 2.2
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

import { Pressable, ScrollView, Text, View } from '@/components/ui';

type FilterOption = {
  label: string;
  value: string;
};

type Props = {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
  testID?: string;
};

export function QueueFilters({
  activeFilter,
  onFilterChange,
  testID = 'queue-filters',
}: Props) {
  const { t } = useTranslation();

  const PRIORITY_FILTERS: FilterOption[] = [
    { label: t('moderation.filters.priority.all'), value: 'all' },
    { label: t('moderation.filters.priority.immediate'), value: 'immediate' },
    { label: t('moderation.filters.priority.illegal'), value: 'illegal' },
    { label: t('moderation.filters.priority.trusted'), value: 'trusted' },
    { label: t('moderation.filters.priority.standard'), value: 'standard' },
  ];
  return (
    <View className="mb-4" testID={testID}>
      <Text className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
        {t('moderation.filterPriority')}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row gap-2">
          {PRIORITY_FILTERS.map((filter) => {
            const isActive = activeFilter === filter.value;
            return (
              <Pressable
                accessibilityRole="button"
                key={filter.value}
                onPress={() => onFilterChange(filter.value)}
                className={`rounded-full px-4 py-2 ${
                  isActive
                    ? 'bg-primary-600'
                    : 'border border-neutral-300 bg-white dark:border-neutral-600 dark:bg-charcoal-800'
                }`}
                style={({ pressed }) => pressed && { opacity: 0.7 }}
                testID={`filter-${filter.value}`}
              >
                <Text
                  className={`text-sm font-medium ${
                    isActive
                      ? 'text-white'
                      : 'text-neutral-700 dark:text-neutral-300'
                  }`}
                >
                  {filter.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
