import * as React from 'react';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

import { Text, View } from '@/components/ui';
import { translate } from '@/lib/i18n';
import type { Strain } from '@/types/strains';

import { EffectsFlavorsSection } from './effects-flavors-section';
import { HardFactsGrid } from './hard-facts-grid';
import { PremiumTagsRow } from './premium-tags-row';

type Props = {
  strain: Strain;
};

export function StrainContentSheet({ strain }: Props): React.ReactElement {
  return (
    <View className="-mt-6 min-h-screen rounded-t-sheet bg-white pb-20 pt-4 shadow-2xl dark:bg-charcoal-900">
      <View className="mb-4 w-full items-center">
        <View className="h-1.5 w-12 rounded-full bg-neutral-200 dark:bg-white/20" />
      </View>
      <PremiumTagsRow strain={strain} />
      <Animated.View
        entering={FadeIn.delay(200)
          .springify()
          .reduceMotion(ReduceMotion.System)}
      >
        <HardFactsGrid strain={strain} />
      </Animated.View>
      <View className="px-6 pb-6">
        <Text className="mb-4 text-xl font-bold text-neutral-900 dark:text-white">
          {translate('strains.detail.about')}
        </Text>
        {strain.description?.map((paragraph, index) => (
          <Animated.Text
            key={index}
            entering={FadeIn.delay(300 + index * 100)
              .springify()
              .reduceMotion(ReduceMotion.System)}
            className="mb-4 text-lg leading-8 text-neutral-600 dark:text-neutral-300"
          >
            {paragraph}
          </Animated.Text>
        ))}
      </View>
      <EffectsFlavorsSection strain={strain} />
    </View>
  );
}
