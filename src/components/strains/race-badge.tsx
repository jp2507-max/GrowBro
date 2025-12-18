import * as React from 'react';

import { Text, View } from '@/components/ui';
import { translate } from '@/lib';
import type { StrainRace } from '@/types/strains';

type Props = {
  race: StrainRace;
  testID?: string;
  variant?: 'default' | 'premium';
};

const getRaceStyles = (race: StrainRace): string => {
  switch (race) {
    case 'indica':
      return 'bg-purple-100 dark:bg-purple-900/40';
    case 'sativa':
      return 'bg-primary-100 dark:bg-primary-900/40';
    case 'hybrid':
      return 'bg-sky-100 dark:bg-sky-900/40';
    default:
      return 'bg-neutral-200 dark:bg-neutral-800';
  }
};

const getRaceTextStyles = (race: StrainRace): string => {
  switch (race) {
    case 'indica':
      return 'text-purple-800 dark:text-purple-200';
    case 'sativa':
      return 'text-primary-800 dark:text-primary-200';
    case 'hybrid':
      return 'text-sky-800 dark:text-sky-200';
    default:
      return 'text-neutral-800 dark:text-neutral-200';
  }
};

export const RaceBadge = React.memo<Props>(
  ({ race, testID, variant = 'default' }) => {
    const isPremium = variant === 'premium';
    const containerStyles = isPremium
      ? 'bg-primary-50 dark:bg-primary-900/30'
      : getRaceStyles(race);
    const textStyles = isPremium
      ? 'text-primary-800 dark:text-primary-200 font-bold'
      : `${getRaceTextStyles(race)} font-semibold`;

    return (
      <View
        className={`rounded-full ${isPremium ? 'px-4 py-2' : 'px-2.5 py-1'} ${containerStyles}`}
        testID={testID}
        accessibilityRole="text"
        accessibilityLabel={translate(`strains.race.${race}`)}
        accessibilityHint={translate(`strains.race.${race}`)}
      >
        <Text className={`text-xs uppercase tracking-wide ${textStyles}`}>
          {translate(`strains.race.${race}`)}
        </Text>
      </View>
    );
  }
);

RaceBadge.displayName = 'RaceBadge';
