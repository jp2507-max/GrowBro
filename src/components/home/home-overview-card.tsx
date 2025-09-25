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
    'gap-2 rounded-2xl border border-neutral-200/80 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-charcoal-900/80';
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
        className="text-xs font-semibold uppercase tracking-wide text-neutral-600 dark:text-neutral-300"
        tx={titleTx}
      />
      <Text className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
        {value}
      </Text>
      {descriptionTx ? (
        <Text
          className="text-xs text-neutral-500 dark:text-neutral-300/80"
          tx={descriptionTx}
        />
      ) : null}
    </View>
  );
}
