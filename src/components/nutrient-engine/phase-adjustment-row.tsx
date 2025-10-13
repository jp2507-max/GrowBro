/**
 * Phase Adjustment Row Component
 *
 * Single row for pH and EC offset inputs per phase
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

import { Input, Text, View } from '@/components/ui';
import type { PlantPhase } from '@/lib/nutrient-engine/types';

interface PhaseAdjustmentRowProps {
  phase: PlantPhase;
  phOffset: number;
  ecOffset: number;
  onPhOffsetChange: (value: number) => void;
  onEcOffsetChange: (value: number) => void;
  testID: string;
}

export function PhaseAdjustmentRow({
  phase,
  phOffset,
  ecOffset,
  onPhOffsetChange,
  onEcOffsetChange,
  testID,
}: PhaseAdjustmentRowProps): JSX.Element {
  const { t } = useTranslation();

  return (
    <View
      className="rounded-lg border border-neutral-300 bg-white p-3 dark:border-neutral-700 dark:bg-charcoal-950"
      testID={testID}
    >
      <Text className="mb-2 font-medium capitalize text-neutral-700 dark:text-neutral-300">
        {phase}
      </Text>

      <View className="flex-row gap-2">
        <View className="flex-1">
          <Input
            label={t('nutrient.phOffset')}
            keyboardType="decimal-pad"
            value={phOffset.toString()}
            onChangeText={(text) => {
              const val = parseFloat(text) || 0;
              onPhOffsetChange(val);
            }}
            placeholder="±0.0"
            testID={`${testID}-ph`}
          />
        </View>

        <View className="flex-1">
          <Input
            label={t('nutrient.ecOffset')}
            keyboardType="decimal-pad"
            value={ecOffset.toString()}
            onChangeText={(text) => {
              const val = parseFloat(text) || 0;
              onEcOffsetChange(val);
            }}
            placeholder="±0.0"
            testID={`${testID}-ec`}
          />
        </View>
      </View>
    </View>
  );
}
