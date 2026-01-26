import * as React from 'react';
import type { useAnimatedScrollHandler } from 'react-native-reanimated';
import Animated from 'react-native-reanimated';

import { Text, View } from '@/components/ui';
import { translate } from '@/lib/i18n';
import type { Strain } from '@/types/strains';

import { StrainContentSheet } from './strain-content-sheet';

type Props = {
  strain: Strain;
  scrollHandler: ReturnType<typeof useAnimatedScrollHandler>;
};

export function StrainScrollContent({
  strain,
  scrollHandler,
}: Props): React.ReactElement {
  return (
    <Animated.ScrollView
      className="z-10 flex-1"
      contentContainerClassName="pb-10"
      showsVerticalScrollIndicator={false}
      onScroll={scrollHandler}
      scrollEventThrottle={16}
      bounces={false}
    >
      <View className="h-hero justify-end px-6 pb-8">
        <View className="mb-2 flex-row gap-2">
          <View className="rounded-full bg-white/20 px-3 py-1 backdrop-blur-md">
            <Text className="text-xs font-bold uppercase tracking-wider text-white">
              {translate(`strains.race.${strain.race}`)}
            </Text>
          </View>
        </View>
        <Text className="text-4xl font-extrabold text-white shadow-sm">
          {strain.name}
        </Text>
      </View>
      <StrainContentSheet strain={strain} />
    </Animated.ScrollView>
  );
}
