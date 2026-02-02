import * as React from 'react';

import { Text, View } from '@/components/ui';
import { translate } from '@/lib';

type Props = {
  thc: string;
  testID?: string;
  variant?: 'default' | 'premium' | 'outline';
};

const THCBadgeComponent = ({
  thc,
  testID,
  variant = 'default',
}: Props): React.ReactElement | null => {
  if (!thc) return null;

  const isPremium = variant === 'premium';
  const isOutline = variant === 'outline';

  const containerStyles = isOutline
    ? 'border border-white/20 bg-transparent px-2 py-0.5'
    : isPremium
      ? 'bg-primary-50 px-4 py-2 dark:bg-primary-900/30'
      : 'bg-warning-100 px-3 py-1.5 dark:bg-warning-800/50';

  const textStyles = isOutline
    ? 'text-[10px] font-medium uppercase tracking-wider text-white/60'
    : isPremium
      ? 'text-[11px] font-bold uppercase tracking-wider text-primary-800 dark:text-primary-200'
      : 'text-[11px] font-bold uppercase tracking-wider text-warning-800 dark:text-warning-200';

  return (
    <View
      className={`rounded-full ${containerStyles}`}
      testID={testID}
      accessibilityRole="text"
      accessibilityLabel={translate('strains.thc', { value: thc })}
      accessibilityHint={translate('strains.thc', { value: thc })}
    >
      <Text className={textStyles}>{thc}</Text>
    </View>
  );
};

export const THCBadge = React.memo<Props>(THCBadgeComponent);

THCBadge.displayName = 'THCBadge';
