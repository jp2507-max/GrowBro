/**
 * Trichome Guide Card Component
 *
 * Displays educational information about trichome stages
 */

import * as React from 'react';
import { ScrollView, View } from 'react-native';

import { Text } from '@/components/ui';
import type { TrichomeGuide } from '@/lib/trichome';

type Props = {
  guide: TrichomeGuide;
  className?: string;
};

function TrichomeStageItem({ stage, isLast }: { stage: any; isLast: boolean }) {
  return (
    <View
      className={`mb-4 rounded-md border border-neutral-200 p-3 dark:border-charcoal-700 ${
        isLast ? 'mb-0' : ''
      }`}
      testID={`trichome-stage-${stage.stage}`}
    >
      <Text className="mb-1 text-base font-semibold text-charcoal-950 dark:text-neutral-100">
        {stage.title}
      </Text>
      <Text className="mb-2 text-sm text-neutral-700 dark:text-neutral-300">
        {stage.description}
      </Text>
      <Text className="text-xs italic text-neutral-600 dark:text-neutral-400">
        {stage.effectProfile}
      </Text>
    </View>
  );
}

function TipsList({ tips }: { tips: string[] }) {
  return (
    <>
      {tips.map((tip, index) => (
        <View key={index} className="mb-2 flex-row">
          <Text className="mr-2 text-sm text-neutral-700 dark:text-neutral-300">
            •
          </Text>
          <Text className="flex-1 text-sm text-neutral-700 dark:text-neutral-300">
            {tip}
          </Text>
        </View>
      ))}
    </>
  );
}

export function TrichomeGuideCard({ guide, className = '' }: Props) {
  return (
    <ScrollView
      className={`rounded-lg bg-white p-4 dark:bg-charcoal-900 ${className}`}
      testID="trichome-guide-card"
    >
      <Text className="mb-4 text-xl font-semibold text-charcoal-950 dark:text-neutral-100">
        Trichome Assessment Guide
      </Text>

      <View className="mb-6">
        {guide.stages.map((stage, index) => (
          <TrichomeStageItem
            key={stage.stage}
            stage={stage}
            isLast={index === guide.stages.length - 1}
          />
        ))}
      </View>

      <View className="mb-6">
        <Text className="mb-2 text-base font-semibold text-charcoal-950 dark:text-neutral-100">
          Photography Tips
        </Text>
        <TipsList tips={guide.photographyTips} />
      </View>

      <View className="mb-6">
        <Text className="mb-2 text-base font-semibold text-charcoal-950 dark:text-neutral-100">
          Lighting Cautions
        </Text>
        {guide.lightingCautions.map((caution, index) => (
          <View key={index} className="mb-2 flex-row">
            <Text className="mr-2 text-sm text-warning-600 dark:text-warning-400">
              ⚠
            </Text>
            <Text className="flex-1 text-sm text-neutral-700 dark:text-neutral-300">
              {caution}
            </Text>
          </View>
        ))}
      </View>

      <View className="rounded-md bg-neutral-100 p-3 dark:bg-charcoal-800">
        <Text className="text-xs italic text-neutral-600 dark:text-neutral-400">
          ⓘ {guide.disclaimer}
        </Text>
      </View>
    </ScrollView>
  );
}
