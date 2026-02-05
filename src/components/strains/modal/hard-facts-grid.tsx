import * as React from 'react';

import { Text, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import { Calendar, Scale, Sprout } from '@/components/ui/icons';
import { translate } from '@/lib/i18n';
import type { Strain } from '@/types/strains';

type Props = {
  strain: Strain;
};

const DIFFICULTY_KEYS = {
  beginner: 'strains.difficulty.beginner',
  intermediate: 'strains.difficulty.intermediate',
  advanced: 'strains.difficulty.advanced',
} as const;

export function HardFactsGrid({ strain }: Props): React.ReactElement {
  const floweringTime =
    strain.grow?.flowering_time?.label ??
    (strain.grow?.flowering_time?.min_weeks &&
    strain.grow?.flowering_time?.max_weeks
      ? `${strain.grow.flowering_time.min_weeks}-${strain.grow.flowering_time.max_weeks}`
      : translate('common.na'));

  const yieldRating =
    strain.grow?.yield?.indoor?.label ??
    strain.grow?.yield?.outdoor?.label ??
    translate('common.na');

  const difficulty = strain.grow?.difficulty
    ? translate(
        DIFFICULTY_KEYS[
          strain.grow.difficulty as keyof typeof DIFFICULTY_KEYS
        ] ?? 'common.na'
      )
    : translate('common.na');

  return (
    <View className="my-8 flex-row justify-between gap-3 px-4">
      <View
        accessibilityRole="text"
        accessibilityLabel={`${translate('strains.hard_facts.flowering_time')}: ${floweringTime}`}
        className="flex-1 items-center justify-center rounded-2xl bg-primary-50 p-4 dark:bg-primary-900/40"
      >
        <Calendar
          width={24}
          height={24}
          color={colors.primary[700]}
          className="mb-2"
        />
        <Text
          className="text-center text-lg font-bold text-neutral-900 dark:text-white"
          numberOfLines={1}
        >
          {floweringTime}
        </Text>
        <Text
          className="mt-1 text-[11px] font-extrabold uppercase tracking-widest text-primary-900/60 dark:text-primary-300/70"
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {translate('strains.hard_facts.flowering_time')}
        </Text>
      </View>

      <View
        accessibilityRole="text"
        accessibilityLabel={`${translate('strains.hard_facts.yield')}: ${yieldRating}`}
        className="flex-1 items-center justify-center rounded-2xl bg-primary-50 p-4 dark:bg-primary-900/40"
      >
        <Scale
          width={24}
          height={24}
          color={colors.ink[700]}
          className="mb-2"
        />
        <Text
          className="text-center text-lg font-bold text-neutral-900 dark:text-white"
          numberOfLines={1}
        >
          {yieldRating}
        </Text>
        <Text
          className="mt-1 text-[11px] font-extrabold uppercase tracking-widest text-primary-900/60 dark:text-primary-300/70"
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {translate('strains.hard_facts.yield')}
        </Text>
      </View>

      <View
        accessibilityRole="text"
        accessibilityLabel={`${translate('strains.hard_facts.cultivation')}: ${difficulty}`}
        className="flex-1 items-center justify-center rounded-2xl bg-primary-50 p-4 dark:bg-primary-900/40"
      >
        <Sprout
          width={24}
          height={24}
          color={colors.primary[700]}
          className="mb-2"
        />
        <Text
          className="text-center text-lg font-bold text-neutral-900 dark:text-white"
          numberOfLines={1}
        >
          {difficulty}
        </Text>
        <Text
          className="mt-1 text-[11px] font-extrabold uppercase tracking-widest text-primary-900/60 dark:text-primary-300/70"
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {translate('strains.hard_facts.cultivation')}
        </Text>
      </View>
    </View>
  );
}
