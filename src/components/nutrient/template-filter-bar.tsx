/**
 * Template Filter Bar Component
 *
 * Medium filter buttons for template list.
 * Highlights active filter and shows all option.
 *
 * Requirements: 1.1, 1.2
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet } from 'react-native';

import { Button, View } from '@/components/ui';
import { GrowingMedium } from '@/lib/nutrient-engine/types';

interface TemplateFilterBarProps {
  selectedMedium: GrowingMedium | null;
  onSelectMedium: (medium: GrowingMedium | null) => void;
  testID?: string;
}

const mediumOptions: { value: GrowingMedium | null; labelKey: string }[] = [
  { value: null, labelKey: 'nutrient.allMediums' },
  { value: GrowingMedium.SOIL, labelKey: 'nutrient.medium.soil' },
  { value: GrowingMedium.COCO, labelKey: 'nutrient.medium.coco' },
  { value: GrowingMedium.HYDRO, labelKey: 'nutrient.medium.hydro' },
  { value: GrowingMedium.SOILLESS, labelKey: 'nutrient.medium.soilless' },
  { value: GrowingMedium.PEAT, labelKey: 'nutrient.medium.peat' },
];

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
  },
});

export function TemplateFilterBar({
  selectedMedium,
  onSelectMedium,
  testID = 'template-filter-bar',
}: TemplateFilterBarProps) {
  const { t } = useTranslation();

  return (
    <View className="mb-4 border-b border-neutral-200 pb-3 dark:border-charcoal-800">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        testID={testID}
      >
        {mediumOptions.map((option) => (
          <Button
            key={option.labelKey}
            label={t(option.labelKey)}
            variant={selectedMedium === option.value ? 'default' : 'outline'}
            onPress={() => onSelectMedium(option.value)}
            className="mr-2 min-w-[80px]"
            testID={`${testID}-${option.labelKey.split('.').pop()}`}
          />
        ))}
      </ScrollView>
    </View>
  );
}
