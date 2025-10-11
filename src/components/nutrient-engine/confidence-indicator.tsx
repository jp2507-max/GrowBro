/**
 * Confidence Indicator Component
 *
 * Displays confidence score for pH/EC readings with visual feedback
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

import { Text, View } from '@/components/ui';

interface ConfidenceIndicatorProps {
  confidence: number; // 0-1
  testID?: string;
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) {
    return 'bg-success-500';
  }
  if (confidence >= 0.6) {
    return 'bg-warning-500';
  }
  return 'bg-danger-500';
}

function getConfidenceLabel(
  confidence: number,
  t: (key: string) => string
): string {
  if (confidence >= 0.8) {
    return t('nutrient.confidence.high');
  }
  if (confidence >= 0.6) {
    return t('nutrient.confidence.medium');
  }
  return t('nutrient.confidence.low');
}

export function ConfidenceIndicator({
  confidence,
  testID,
}: ConfidenceIndicatorProps) {
  const { t } = useTranslation();
  const percentage = Math.round(confidence * 100);

  return (
    <View
      className="rounded-lg bg-neutral-100 p-3 dark:bg-neutral-800"
      testID={testID}
    >
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {t('nutrient.confidence.label')}
        </Text>
        <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          {percentage}%
        </Text>
      </View>

      <View className="mb-1 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
        <View
          className={`h-full ${getConfidenceColor(confidence)}`}
          style={{ width: `${percentage}%` }}
          testID={`${testID}-bar`}
        />
      </View>

      <Text className="text-xs text-neutral-600 dark:text-neutral-400">
        {getConfidenceLabel(confidence, t)}
      </Text>
    </View>
  );
}
