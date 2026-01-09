import React from 'react';

import { Text, View } from '@/components/ui';
import type { TrichomeGuide } from '@/lib/trichome';

type TrichomeQuickReferenceProps = {
  guide: TrichomeGuide;
};

export function TrichomeQuickReference({
  guide,
}: TrichomeQuickReferenceProps): React.ReactElement {
  return (
    <View className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-charcoal-800 dark:bg-charcoal-900">
      <Text
        className="mb-3 text-sm font-semibold text-neutral-900 dark:text-neutral-100"
        tx="trichome.helper.quick_reference"
      />
      {guide.stages.map((stage, index) => (
        <View
          key={stage.stage}
          className={`${index > 0 ? 'mt-2' : ''} rounded-lg bg-neutral-50 p-2 dark:bg-charcoal-800`}
        >
          <Text className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
            {stage.title}
          </Text>
          <Text className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
            {stage.effectProfile}
          </Text>
        </View>
      ))}
    </View>
  );
}
