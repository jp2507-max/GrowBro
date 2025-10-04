/**
 * Inheritance Badge
 *
 * Shows if a task has been manually edited and its inheritance status
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

import type { PlaybookTaskMetadata } from '@/types/playbook';

import { Text, View } from '../ui';

interface InheritanceBadgeProps {
  metadata: PlaybookTaskMetadata;
  variant?: 'compact' | 'full';
}

export function InheritanceBadge({
  metadata,
  variant = 'compact',
}: InheritanceBadgeProps) {
  const { t } = useTranslation();

  const isManuallyEdited = metadata?.flags?.manualEdited || false;
  const excludedFromBulkShift = metadata?.flags?.excludeFromBulkShift || false;

  if (!isManuallyEdited) {
    return null;
  }

  if (variant === 'compact') {
    return (
      <View
        className="rounded-full bg-primary-100 px-2 py-0.5 dark:bg-primary-900"
        testID="inheritance-badge-compact"
      >
        <Text className="text-xs font-medium text-primary-700 dark:text-primary-300">
          {t('playbooks.edited')}
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-1" testID="inheritance-badge-full">
      <View className="flex-row items-center gap-2">
        <View className="size-2 rounded-full bg-primary-500" />
        <Text className="text-sm font-medium text-charcoal-900 dark:text-neutral-100">
          {t('playbooks.manuallyEdited')}
        </Text>
      </View>
      {excludedFromBulkShift && (
        <Text className="ml-4 text-xs text-neutral-600 dark:text-neutral-400">
          {t('playbooks.excludedFromBulkOperations')}
        </Text>
      )}
    </View>
  );
}
