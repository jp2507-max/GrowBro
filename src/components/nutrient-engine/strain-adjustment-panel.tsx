/**
 * Strain Adjustment Panel Component
 *
 * UI for strain-specific pH/EC target band offsets
 *
 * Requirements: 4.6, 4.7
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Text, View } from '@/components/ui';
import type { StrainAdjustment } from '@/lib/nutrient-engine/hooks/use-strain-adjustments';
import { useStrainAdjustments } from '@/lib/nutrient-engine/hooks/use-strain-adjustments';
import { PlantPhase } from '@/lib/nutrient-engine/types';

import { PhaseAdjustmentRow } from './phase-adjustment-row';

type StrainAdjustmentPanelProps = {
  adjustments: StrainAdjustment[];
  onAdjustmentsChange: (adjustments: StrainAdjustment[]) => void;
  onSaveAsProfile?: () => void;
  testID?: string;
};

export function StrainAdjustmentPanel({
  adjustments,
  onAdjustmentsChange,
  onSaveAsProfile,
  testID = 'strain-adjustment',
}: StrainAdjustmentPanelProps): React.JSX.Element {
  const { t } = useTranslation();
  const { updateAdjustment, getAdjustment, hasAnyAdjustments } =
    useStrainAdjustments(adjustments, onAdjustmentsChange);

  return (
    <View
      className="rounded-xl bg-neutral-50 p-4 dark:bg-charcoal-900"
      testID={testID}
    >
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          {t('nutrient.strainAdjustments')}
        </Text>
        {hasAnyAdjustments && onSaveAsProfile && (
          <Button
            label={t('nutrient.saveProfile')}
            onPress={onSaveAsProfile}
            variant="outline"
            testID={`${testID}-save-profile`}
          />
        )}
      </View>

      <Text className="mb-3 text-sm text-neutral-600 dark:text-neutral-400">
        {t('nutrient.strainAdjustmentsHelp')}
      </Text>

      <View className="gap-3">
        {(Object.values(PlantPhase) as PlantPhase[]).map((phase) => {
          const adj = getAdjustment(phase);
          return (
            <PhaseAdjustmentRow
              key={phase}
              phase={phase}
              phOffset={adj.phOffset}
              ecOffset={adj.ecOffset}
              onPhOffsetChange={(val) =>
                updateAdjustment(phase, 'phOffset', val)
              }
              onEcOffsetChange={(val) =>
                updateAdjustment(phase, 'ecOffset', val)
              }
              testID={`${testID}-${phase}`}
            />
          );
        })}
      </View>

      {hasAnyAdjustments && (
        <View className="mt-3 rounded-lg bg-primary-50 p-3 dark:bg-primary-900">
          <Text className="text-sm text-primary-700 dark:text-primary-300">
            {t('nutrient.adjustmentsPreview')}
          </Text>
        </View>
      )}
    </View>
  );
}
