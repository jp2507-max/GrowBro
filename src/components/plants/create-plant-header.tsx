import React from 'react';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { Text, View } from '@/components/ui';
import { translate } from '@/lib/i18n';

const HEADER_PADDING_TOP = 12;

type CreatePlantHeaderProps = {
  insets: EdgeInsets;
  completion: number;
};

/**
 * Progress bar component with terracotta active color.
 */
function ProgressBar({ progress }: { progress: number }): React.ReactElement {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <View className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/20">
      <View
        className="h-full rounded-full bg-terracotta-500"
        style={{ width: `${clampedProgress}%` }}
      />
    </View>
  );
}

/**
 * Premium Organic header for CreatePlant screen.
 * Dark green with rounded bottom, contains title and progress bar.
 */
export function CreatePlantHeader({
  insets,
  completion,
}: CreatePlantHeaderProps): React.ReactElement {
  return (
    <View
      className="z-0 bg-primary-900 px-6 pb-20 dark:bg-primary-800"
      style={{ paddingTop: insets.top + HEADER_PADDING_TOP }}
    >
      {/* Title */}
      <Text className="text-3xl font-bold tracking-tight text-white">
        {translate('plants.form.create_title')}
      </Text>

      {/* Subtext */}
      <Text className="mt-1 text-sm font-medium uppercase tracking-widest text-primary-200">
        {translate('plants.form.completion', { percent: completion })}
      </Text>

      {/* Progress bar with terracotta active color */}
      <ProgressBar progress={completion} />
    </View>
  );
}
