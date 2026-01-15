import * as React from 'react';

import { Text, View } from '@/components/ui';
import { translate } from '@/lib';
import type { GrowDifficulty } from '@/types/strains';

type Props = {
  difficulty: GrowDifficulty;
  testID?: string;
  variant?: 'default' | 'premium';
};

const getDifficultyStyles = (difficulty: GrowDifficulty): string => {
  switch (difficulty) {
    case 'beginner':
      return 'bg-success-100 dark:bg-success-800/50';
    case 'intermediate':
      return 'bg-warning-100 dark:bg-warning-800/50';
    case 'advanced':
      return 'bg-danger-100 dark:bg-danger-800/50';
    default:
      return 'bg-neutral-200 dark:bg-neutral-700';
  }
};

const getDifficultyTextStyles = (difficulty: GrowDifficulty): string => {
  switch (difficulty) {
    case 'beginner':
      return 'text-success-800 dark:text-success-200';
    case 'intermediate':
      return 'text-warning-800 dark:text-warning-200';
    case 'advanced':
      return 'text-danger-800 dark:text-danger-200';
    default:
      return 'text-neutral-800 dark:text-neutral-200';
  }
};

export const DifficultyBadge = React.memo<Props>(
  ({ difficulty, testID, variant = 'default' }) => {
    const isPremium = variant === 'premium';
    const containerStyles = isPremium
      ? 'bg-primary-50 dark:bg-primary-900/30'
      : getDifficultyStyles(difficulty);
    const textStyles = isPremium
      ? 'text-primary-800 dark:text-primary-200'
      : getDifficultyTextStyles(difficulty);

    return (
      <View
        className={`rounded-full ${isPremium ? 'px-4 py-2' : 'px-3 py-1.5'} ${containerStyles}`}
        testID={testID}
        accessibilityRole="text"
        accessibilityLabel={translate(`strains.difficulty.${difficulty}`)}
        accessibilityHint={translate(`strains.difficulty.${difficulty}_hint`)}
      >
        <Text
          className={`text-[11px] font-bold uppercase tracking-wider ${textStyles}`}
        >
          {translate(`strains.difficulty.${difficulty}`)}
        </Text>
      </View>
    );
  }
);

DifficultyBadge.displayName = 'DifficultyBadge';
