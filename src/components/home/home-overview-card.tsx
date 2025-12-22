import React from 'react';

import { Text, View } from '@/components/ui';
import type { TxKeyPath } from '@/lib/i18n';

type Props = {
  titleTx: TxKeyPath;
  value: string;
  descriptionTx?: TxKeyPath;
  className?: string;
  testID: string;
};

export function HomeOverviewCard({
  titleTx,
  value,
  descriptionTx,
  className,
  testID,
}: Props): React.ReactElement {
  const baseClassName =
    'gap-2 rounded-2xl border border-neutral-200 dark:border-charcoal-700 bg-card p-4';
  const containerClassName = className
    ? `${baseClassName} ${className}`
    : baseClassName;

  return (
    <View
      className={containerClassName}
      testID={testID}
      accessibilityRole="summary"
    >
      <Text
        className="text-xs font-semibold uppercase tracking-wide text-neutral-600 dark:text-neutral-400"
        tx={titleTx}
      />
      <Text className="text-2xl font-semibold text-charcoal-900 dark:text-neutral-100">
        {value}
      </Text>
      {descriptionTx ? (
        <Text className="text-text-secondary text-xs" tx={descriptionTx} />
      ) : null}
    </View>
  );
}
