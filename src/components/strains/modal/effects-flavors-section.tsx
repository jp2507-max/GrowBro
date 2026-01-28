import * as React from 'react';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

import { Text, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import { Leaf, Smile } from '@/components/ui/icons';
import { translate } from '@/lib/i18n';
import type { Strain } from '@/types/strains';

type Props = {
  strain: Strain;
};

export function EffectsFlavorsSection({ strain }: Props): React.ReactElement {
  return (
    <Animated.View
      entering={FadeIn.delay(400).springify().reduceMotion(ReduceMotion.System)}
      className="mt-8 px-6 pb-20"
    >
      {strain.effects && strain.effects.length > 0 && (
        <View className="mb-8" testID="strain-effects">
          <Text className="mb-4 text-lg font-bold text-neutral-900 dark:text-white">
            {translate('strains.detail.effects')}
          </Text>
          <View className="flex-row flex-wrap">
            {strain.effects.map((effect, index) => (
              <View
                key={`${effect.name}-${index}`}
                className="mb-3 mr-3 flex-row items-center rounded-full border border-primary-200 bg-primary-100 px-5 py-3 dark:border-primary-700 dark:bg-primary-900/40"
              >
                <Smile
                  width={18}
                  height={18}
                  color={colors.ink[700]}
                  className="mr-2"
                />
                <Text className="text-sm font-bold text-primary-900 dark:text-primary-100">
                  {effect.name}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {strain.flavors && strain.flavors.length > 0 && (
        <View testID="strain-flavors">
          <Text className="mb-4 text-lg font-bold text-neutral-900 dark:text-white">
            {translate('strains.detail.flavors')}
          </Text>
          <View className="flex-row flex-wrap">
            {strain.flavors.map((flavor, index) => (
              <View
                key={`${flavor.name}-${index}`}
                className="mb-3 mr-3 flex-row items-center rounded-full border border-primary-200 bg-primary-100 px-5 py-3 dark:border-primary-700 dark:bg-primary-900/40"
              >
                <Leaf
                  width={18}
                  height={18}
                  color={colors.ink[700]}
                  className="mr-2"
                />
                <Text className="text-sm font-bold text-primary-900 dark:text-primary-100">
                  {flavor.name}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </Animated.View>
  );
}
