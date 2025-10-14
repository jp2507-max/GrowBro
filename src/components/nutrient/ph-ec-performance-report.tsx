import React from 'react';

import { Button, Text, View } from '@/components/ui';
import { translate } from '@/lib';

type Reading = {
  ph: number;
  ec: number;
  timestamp: number;
};

type PerformanceMetrics = {
  phTimeInBand: number;
  ecTimeInBand: number;
  medianCorrectionTime: number;
  deviationPatterns: string[];
  performanceScore: number;
};

type Props = {
  readings: Reading[];
  phRange: { min: number; max: number };
  ecRange: { min: number; max: number };
  onApplyLearnings?: () => void;
  testID?: string;
};

function calculateMetrics(
  readings: Reading[],
  phRange: { min: number; max: number },
  ecRange: { min: number; max: number }
): PerformanceMetrics {
  if (readings.length === 0) {
    return {
      phTimeInBand: 0,
      ecTimeInBand: 0,
      medianCorrectionTime: 0,
      deviationPatterns: [],
      performanceScore: 0,
    };
  }

  const phInBand = readings.filter(
    (r) => r.ph >= phRange.min && r.ph <= phRange.max
  ).length;
  const ecInBand = readings.filter(
    (r) => r.ec >= ecRange.min && r.ec <= ecRange.max
  ).length;

  const phTimeInBand = (phInBand / readings.length) * 100;
  const ecTimeInBand = (ecInBand / readings.length) * 100;

  const performanceScore = (phTimeInBand + ecTimeInBand) / 2;

  return {
    phTimeInBand,
    ecTimeInBand,
    medianCorrectionTime: 0,
    deviationPatterns: [],
    performanceScore,
  };
}

export function PhEcPerformanceReport({
  readings,
  phRange,
  ecRange,
  onApplyLearnings,
  testID,
}: Props): React.ReactElement {
  const metrics = calculateMetrics(readings, phRange, ecRange);

  return (
    <View className="p-4" testID={testID}>
      <Text className="mb-4 text-lg font-semibold text-neutral-900">
        {translate('nutrient.performance_report')}
      </Text>

      <View className="mb-4 rounded-lg border border-neutral-200 bg-white p-4">
        <View className="mb-3">
          <Text className="text-sm text-neutral-600">pH Time in Band</Text>
          <Text className="text-2xl font-bold text-neutral-900">
            {metrics.phTimeInBand.toFixed(1)}%
          </Text>
        </View>

        <View className="mb-3">
          <Text className="text-sm text-neutral-600">EC Time in Band</Text>
          <Text className="text-2xl font-bold text-neutral-900">
            {metrics.ecTimeInBand.toFixed(1)}%
          </Text>
        </View>

        <View>
          <Text className="text-sm text-neutral-600">Performance Score</Text>
          <Text className="text-2xl font-bold text-primary-600">
            {metrics.performanceScore.toFixed(1)}%
          </Text>
        </View>
      </View>

      {onApplyLearnings && (
        <Button
          label={translate('nutrient.apply_learnings')}
          onPress={onApplyLearnings}
          testID={`${testID}.applyLearnings`}
        />
      )}
    </View>
  );
}
