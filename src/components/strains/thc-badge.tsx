import * as React from 'react';

import { Text, View } from '@/components/ui';
import { translate } from '@/lib';

type Props = {
  thc: string;
  testID?: string;
};

const THCBadgeComponent = ({
  thc,
  testID,
}: Props): React.ReactElement | null => {
  if (!thc) return null;

  return (
    <View
      className="rounded-full bg-warning-100 px-2.5 py-1 dark:bg-warning-900/40"
      testID={testID}
      accessibilityRole="text"
      accessibilityLabel={translate('strains.thc', { value: thc })}
      accessibilityHint={translate('strains.thc', { value: thc })}
    >
      <Text className="text-xs font-semibold uppercase tracking-wide text-warning-800 dark:text-warning-200">
        {thc}
      </Text>
    </View>
  );
};

export const THCBadge = React.memo<Props>(THCBadgeComponent);

THCBadge.displayName = 'THCBadge';
