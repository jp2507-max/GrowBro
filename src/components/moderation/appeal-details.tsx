import React from 'react';
import { useTranslation } from 'react-i18next';

import { Text, View } from '@/components/ui';
import type { Appeal } from '@/types/moderation';

export function AppealDetails({
  appeal,
  daysUntilDeadline,
  testID,
}: {
  appeal: Appeal;
  daysUntilDeadline: number;
  testID?: string;
}) {
  const { t } = useTranslation();
  return (
    <View
      className="mb-6 rounded-lg bg-neutral-100 p-4 dark:bg-charcoal-900"
      testID={testID}
    >
      <View className="mb-3">
        <Text className="text-xs text-neutral-600 dark:text-neutral-400">
          {t('appeals.label.appealId')}
        </Text>
        <Text className="font-mono text-sm text-charcoal-950 dark:text-neutral-100">
          {appeal.id}
        </Text>
      </View>

      <View className="mb-3">
        <Text className="text-xs text-neutral-600 dark:text-neutral-400">
          {t('appeals.label.submittedAt')}
        </Text>
        <Text className="text-sm text-charcoal-950 dark:text-neutral-100">
          {appeal.submitted_at.toLocaleString()}
        </Text>
      </View>

      {appeal.status !== 'resolved' && (
        <View className="mb-3">
          <Text className="text-xs text-neutral-600 dark:text-neutral-400">
            {t('appeals.label.deadline')}
          </Text>
          <Text className="text-sm text-charcoal-950 dark:text-neutral-100">
            {appeal.deadline.toLocaleDateString()} ({daysUntilDeadline} days
            remaining)
          </Text>
        </View>
      )}

      {appeal.reviewer_id && (
        <View className="mb-3">
          <Text className="text-xs text-neutral-600 dark:text-neutral-400">
            {t('appeals.label.reviewer')}
          </Text>
          <Text className="text-sm text-charcoal-950 dark:text-neutral-100">
            {t('appeals.value.assignedToReviewer')}
          </Text>
        </View>
      )}

      {appeal.resolved_at && (
        <View>
          <Text className="text-xs text-neutral-600 dark:text-neutral-400">
            {t('appeals.label.resolvedAt')}
          </Text>
          <Text className="text-sm text-charcoal-950 dark:text-neutral-100">
            {appeal.resolved_at.toLocaleString()}
          </Text>
        </View>
      )}
    </View>
  );
}

export default AppealDetails;
