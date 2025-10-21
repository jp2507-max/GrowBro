import React from 'react';
import { useTranslation } from 'react-i18next';

import { Text, View } from '@/components/ui';
import type { ModerationDecision } from '@/types/moderation';

type OriginalDecisionContextProps = {
  originalDecision: ModerationDecision;
};

export function OriginalDecisionContext({
  originalDecision,
}: OriginalDecisionContextProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <View
      testID="original-decision-container"
      className="mb-6 rounded-lg bg-neutral-100 p-4 dark:bg-charcoal-900"
    >
      <Text
        testID="original-decision-title"
        className="mb-2 text-sm font-bold text-charcoal-950 dark:text-neutral-100"
      >
        {t('appeals.label.originalDecision')}
      </Text>
      <View className="mb-2">
        <Text
          testID="original-decision-action-label"
          className="text-xs text-neutral-600 dark:text-neutral-400"
        >
          {t('appeals.label.action')}
        </Text>
        <Text
          testID="original-decision-action-value"
          className="text-sm text-charcoal-950 dark:text-neutral-100"
        >
          {originalDecision.action}
        </Text>
      </View>
      <View className="mb-2">
        <Text
          testID="original-decision-reasoning-label"
          className="text-xs text-neutral-600 dark:text-neutral-400"
        >
          {t('appeals.label.reasoning')}
        </Text>
        <Text
          testID="original-decision-reasoning-value"
          className="text-sm text-charcoal-950 dark:text-neutral-100"
        >
          {originalDecision.reasoning}
        </Text>
      </View>
      <View>
        <Text
          testID="original-decision-policy-violations-label"
          className="text-xs text-neutral-600 dark:text-neutral-400"
        >
          {t('appeals.label.policyViolations')}
        </Text>
        <Text
          testID="original-decision-policy-violations-value"
          className="text-sm text-charcoal-950 dark:text-neutral-100"
        >
          {originalDecision.policy_violations.length === 0
            ? t('appeals.label.noPolicyViolations')
            : originalDecision.policy_violations
                .map((id) => t(`policies.${id}`, { defaultValue: id }))
                .join(', ')}
        </Text>
      </View>
    </View>
  );
}
