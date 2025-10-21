import React from 'react';
import { useTranslation } from 'react-i18next';

import { Text, View } from '@/components/ui';
import type { ModerationDecision } from '@/types/moderation';

type OriginalDecisionContextProps = {
  originalDecision: ModerationDecision;
};

export function OriginalDecisionContext({
  originalDecision,
}: OriginalDecisionContextProps) {
  const { t } = useTranslation();

  return (
    <View className="mb-6 rounded-lg bg-neutral-100 p-4 dark:bg-charcoal-900">
      <Text className="mb-2 text-sm font-bold text-charcoal-950 dark:text-neutral-100">
        {t('appeals.label.originalDecision')}
      </Text>
      <View className="mb-2">
        <Text className="text-xs text-neutral-600 dark:text-neutral-400">
          {t('appeals.label.action')}
        </Text>
        <Text className="text-sm text-charcoal-950 dark:text-neutral-100">
          {originalDecision.action}
        </Text>
      </View>
      <View className="mb-2">
        <Text className="text-xs text-neutral-600 dark:text-neutral-400">
          {t('appeals.label.reasoning')}
        </Text>
        <Text className="text-sm text-charcoal-950 dark:text-neutral-100">
          {originalDecision.reasoning}
        </Text>
      </View>
      <View>
        <Text className="text-xs text-neutral-600 dark:text-neutral-400">
          {t('appeals.label.policyViolations')}
        </Text>
        <Text className="text-sm text-charcoal-950 dark:text-neutral-100">
          {originalDecision.policy_violations.join(', ')}
        </Text>
      </View>
    </View>
  );
}
