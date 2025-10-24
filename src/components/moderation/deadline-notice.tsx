import React from 'react';
import { useTranslation } from 'react-i18next';

import { Text, View } from '@/components/ui';

type DeadlineNoticeProps = {
  deadline: Date;
};

export function DeadlineNotice({ deadline }: DeadlineNoticeProps) {
  const { t } = useTranslation();

  const daysUntilDeadline = Math.ceil(
    (deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  return (
    <View className="mb-4 rounded-lg bg-warning-100 p-3 dark:bg-warning-900">
      <Text className="text-sm font-medium text-warning-900 dark:text-warning-100">
        {t('appeals.notice.deadline', {
          days: daysUntilDeadline,
          date: deadline.toLocaleDateString(),
        })}
      </Text>
    </View>
  );
}
