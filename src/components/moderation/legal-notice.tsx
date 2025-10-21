import React from 'react';
import { useTranslation } from 'react-i18next';

import { Text, View } from '@/components/ui';

export function LegalNotice() {
  const { t } = useTranslation();

  return (
    <View className="mt-4">
      <Text className="text-xs text-neutral-500 dark:text-neutral-500">
        {t('appeals.legal.freeOfCharge')}
      </Text>
      <Text className="mt-1 text-xs text-neutral-500 dark:text-neutral-500">
        {t('appeals.legal.humanReviewGuarantee')}
      </Text>
    </View>
  );
}

export default LegalNotice;
