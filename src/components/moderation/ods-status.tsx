import React from 'react';
import { useTranslation } from 'react-i18next';

import { Text, View } from '@/components/ui';
import type { Appeal } from '@/types/moderation';

export function OdsStatus({ appeal }: { appeal: Appeal }) {
  const { t } = useTranslation();
  if (appeal.status !== 'escalated_to_ods') return null;
  return (
    <View
      testID="ods-status-container"
      className="rounded-lg bg-neutral-100 p-4 dark:bg-charcoal-900"
    >
      <Text
        testID="ods-status-title"
        className="mb-2 text-sm font-bold text-charcoal-950 dark:text-neutral-100"
      >
        {t('appeals.ods.status.escalated')}
      </Text>
      <View className="mb-2">
        <Text
          testID="ods-status-body-label"
          className="text-xs text-neutral-600 dark:text-neutral-400"
        >
          {t('appeals.ods.label.body')}
        </Text>
        <Text
          testID="ods-status-body-value"
          className="text-sm text-charcoal-950 dark:text-neutral-100"
        >
          {appeal.ods_body_name || t('common.unknown')}
        </Text>
      </View>
      {appeal.ods_submitted_at && (
        <View testID="ods-status-submittedAt-container" className="mb-2">
          <Text
            testID="ods-status-submittedAt-label"
            className="text-xs text-neutral-600 dark:text-neutral-400"
          >
            {t('appeals.ods.label.submittedAt')}
          </Text>
          <Text
            testID="ods-status-submittedAt-value"
            className="text-sm text-charcoal-950 dark:text-neutral-100"
          >
            {appeal.ods_submitted_at.toLocaleString()}
          </Text>
        </View>
      )}
      <View>
        <Text
          testID="ods-status-targetResolution-label"
          className="text-xs text-neutral-600 dark:text-neutral-400"
        >
          {t('appeals.ods.label.targetResolution')}
        </Text>
        <Text
          testID="ods-status-targetResolution-value"
          className="text-sm text-charcoal-950 dark:text-neutral-100"
        >
          {t('appeals.ods.value.withinDays', { days: 90 })}
        </Text>
      </View>
    </View>
  );
}

export default OdsStatus;
