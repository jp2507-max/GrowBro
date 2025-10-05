import React from 'react';

import { TrichomeGuideCard } from '@/components/trichome/trichome-guide-card';
import { Text, View } from '@/components/ui';
import type { TrichomeGuide } from '@/lib/trichome';

type TrichomeGuideContentProps = {
  guide: TrichomeGuide;
};

export function TrichomeGuideContent({ guide }: TrichomeGuideContentProps) {
  return (
    <>
      {/* Educational Guide */}
      <TrichomeGuideCard guide={guide} className="mb-4" />

      {/* Macro Photography Tips Section */}
      <View className="mb-4 rounded-lg border border-primary-200 bg-primary-50 p-4 dark:border-primary-800 dark:bg-primary-900/20">
        <Text
          className="mb-2 text-base font-semibold text-primary-800 dark:text-primary-200"
          tx="trichome.photographyTips"
        />
        <View className="gap-2">
          {guide.photographyTips.map((tip, index) => (
            <View key={index} className="flex-row">
              <Text className="mr-2 text-sm text-primary-700 dark:text-primary-300">
                •
              </Text>
              <Text className="flex-1 text-sm text-primary-700 dark:text-primary-300">
                {tip}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Lighting Cautions */}
      <View className="mb-4 rounded-lg border border-warning-200 bg-warning-50 p-4 dark:border-warning-800 dark:bg-warning-900/20">
        <Text
          className="mb-2 text-base font-semibold text-warning-800 dark:text-warning-200"
          tx="trichome.lightingCautions"
        />
        <View className="gap-2">
          {guide.lightingCautions.map((caution, index) => (
            <View key={index} className="flex-row">
              <Text className="mr-2 text-sm text-warning-700 dark:text-warning-300">
                •
              </Text>
              <Text className="flex-1 text-sm text-warning-700 dark:text-warning-300">
                {caution}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Educational Disclaimer */}
      <View className="rounded-lg border border-neutral-200 bg-neutral-100 p-4 dark:border-charcoal-800 dark:bg-charcoal-800">
        <Text className="text-xs italic text-neutral-600 dark:text-neutral-400">
          ℹ️ {guide.disclaimer}
        </Text>
      </View>
    </>
  );
}
