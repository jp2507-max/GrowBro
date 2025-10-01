import * as React from 'react';

import { Text, View } from '@/components/ui';
import { translate } from '@/lib';
import type { GrowDifficulty } from '@/types/strains';

type Props = {
  difficulty: GrowDifficulty;
  testID?: string;
};

const getDifficultyStyles = (difficulty: GrowDifficulty): string => {
  switch (difficulty) {
    case 'beginner':
      return 'bg-success-100 dark:bg-success-900/40';
    case 'intermediate':
      return 'bg-warning-100 dark:bg-warning-900/40';
    case 'advanced':
      return 'bg-danger-100 dark:bg-danger-900/40';
    default:
      return 'bg-neutral-200 dark:bg-neutral-800';
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

export const DifficultyBadge = React.memo<Props>(({ difficulty, testID }) => {
  const containerStyles = getDifficultyStyles(difficulty);
  const textStyles = getDifficultyTextStyles(difficulty);

  return (
    <View
      className={`rounded-full px-2.5 py-1 ${containerStyles}`}
      testID={testID}
      accessibilityRole="text"
      accessibilityLabel={translate(`strains.difficulty.${difficulty}`)}
    >
      <Text
        className={`text-xs font-semibold uppercase tracking-wide ${textStyles}`}
      >
        {translate(`strains.difficulty.${difficulty}`)}
      </Text>
    </View>
  );
});

DifficultyBadge.displayName = 'DifficultyBadge';
