import * as React from 'react';

import { Text, View } from '@/components/ui';
import { translate } from '@/lib';
import type { StrainRace } from '@/types/strains';

type Props = {
  race: StrainRace;
  testID?: string;
  variant?: 'default' | 'premium' | 'neon';
};

const getRaceStyles = (race: StrainRace): string => {
  switch (race) {
    case 'indica':
      return 'bg-purple-100 dark:bg-purple-800/50';
    case 'sativa':
      return 'bg-primary-100 dark:bg-primary-800/50';
    case 'hybrid':
      return 'bg-sky-100 dark:bg-sky-800/50';
    default:
      return 'bg-neutral-200 dark:bg-neutral-700';
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
    const isNeon = variant === 'neon';

    const containerStyles = isNeon
      ? 'bg-neon-lime px-3 py-1 shadow-[0_0_15px_rgba(148,250,46,0.4)]'
      : isPremium
        ? 'bg-primary-50 dark:bg-primary-900/30 px-4 py-2'
        : `${getRaceStyles(race)} px-3 py-1.5`;

    const textStyles = isNeon
      ? 'text-black text-xs font-bold uppercase tracking-widest'
      : isPremium
        ? 'text-[11px] font-bold uppercase tracking-wider text-primary-800 dark:text-primary-200'
        : `text-[11px] font-bold uppercase tracking-wider ${getRaceTextStyles(race)}`;

    return (
      <View
        className={`rounded-full ${containerStyles}`}
        testID={testID}
        accessibilityRole="text"
        accessibilityLabel={translate(`strains.race.${race}`)}
        accessibilityHint={translate(`strains.race.${race}`)}
      >
        <Text className={textStyles}>{translate(`strains.race.${race}`)}</Text>
      </View>
    );
  }
);

RaceBadge.displayName = 'RaceBadge';
