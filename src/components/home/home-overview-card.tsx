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
  const baseClassName = 'gap-2 rounded-2xl border border-border bg-card p-4';
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
        className="text-xs font-semibold uppercase tracking-wide text-text-secondary"
        tx={titleTx}
      />
      <Text className="text-2xl font-semibold text-text-primary">{value}</Text>
      {descriptionTx ? (
        <Text className="text-xs text-text-secondary" tx={descriptionTx} />
      ) : null}
    </View>
  );
}
