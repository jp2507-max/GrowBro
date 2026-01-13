import * as React from 'react';

import { Text, View } from '@/components/ui';
import { translate } from '@/lib';

type Props = {
  thc: string;
  testID?: string;
  variant?: 'default' | 'premium';
};

const THCBadgeComponent = ({
  thc,
  testID,
  variant = 'default',
}: Props): React.ReactElement | null => {
  if (!thc) return null;

  const isPremium = variant === 'premium';

  return (
    <View
      className={`rounded-full ${
        isPremium
          ? 'bg-primary-50 px-4 py-2 dark:bg-primary-900/30'
          : 'bg-warning-100 px-3 py-1.5 dark:bg-warning-800/50'
      }`}
      testID={testID}
      accessibilityRole="text"
      accessibilityLabel={translate('strains.thc', { value: thc })}
      accessibilityHint={translate('strains.thc', { value: thc })}
    >
      <Text
        className={`text-[11px] uppercase tracking-wider ${
          isPremium
            ? 'font-bold text-primary-800 dark:text-primary-200'
            : 'font-bold text-warning-800 dark:text-warning-200'
        }`}
      >
        {thc}
      </Text>
    </View>
  );
};

export const THCBadge = React.memo<Props>(THCBadgeComponent);

THCBadge.displayName = 'THCBadge';
