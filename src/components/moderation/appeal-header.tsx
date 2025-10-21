import React from 'react';
import { useTranslation } from 'react-i18next';

import { Text, View } from '@/components/ui';

export function AppealHeader() {
  const { t } = useTranslation();

  return (
    <View className="mb-6">
      <Text className="mb-2 text-2xl font-bold text-charcoal-950 dark:text-neutral-100">
        {t('appeals.title.submitAppeal')}
      </Text>
      <Text className="text-sm text-neutral-600 dark:text-neutral-400">
        {t('appeals.subtitle.humanReview')}
      </Text>
    </View>
  );
}
