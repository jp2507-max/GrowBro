/**
 * Reservoir Correction Panel Component
 *
 * Calculates stepwise EC adjustments with safety disclaimers.
 * Only shown when reservoir and stock concentration are provided.
 *
 * Requirements: 2.8
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Input, Text, View } from '@/components/ui';
import {
  calculateDilution,
  calculateEcAdjustment,
  formatDilution,
  formatDosingStep,
} from '@/lib/nutrient-engine/utils/dosing-calculator';

interface ReservoirCorrectionPanelProps {
  currentEc: number;
  targetEc: number;
  reservoirVolumeL: number;
  onClose: () => void;
  testID?: string;
}

function CurrentReadings({
  currentEc,
  targetEc,
  reservoirVolumeL,
}: {
  currentEc: number;
  targetEc: number;
  reservoirVolumeL: number;
}) {
  const { t } = useTranslation();
  return (
    <View className="mb-2">
      <Text className="text-sm text-primary-800 dark:text-primary-200">
        {t('nutrient.currentEc')}: {currentEc.toFixed(2)} mS/cm
      </Text>
      <Text className="text-sm text-primary-800 dark:text-primary-200">
        {t('nutrient.targetEc')}: {targetEc.toFixed(2)} mS/cm
      </Text>
      <Text className="text-sm text-primary-800 dark:text-primary-200">
        {t('nutrient.reservoirVolume')}: {reservoirVolumeL.toFixed(1)} L
      </Text>
    </View>
  );
}

function GuidanceDisplay({ guidance }: { guidance: any }) {
  const { t } = useTranslation();
  return (
    <View className="mt-3 rounded-md bg-neutral-50 p-3 dark:bg-charcoal-900">
      {'steps' in guidance ? (
        <>
          <Text className="mb-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {t('nutrient.stepwiseAddition')}
          </Text>
          {guidance.steps.map((step: any, idx: number) => (
            <Text
              key={idx}
              className="mb-1 text-sm text-neutral-700 dark:text-neutral-300"
            >
              {formatDosingStep(step)}
            </Text>
          ))}
          <Text className="mt-2 text-xs font-semibold text-neutral-800 dark:text-neutral-200">
            {t('nutrient.totalAddition')}: {guidance.totalMl.toFixed(1)} ml
          </Text>
        </>
      ) : (
        <>
          <Text className="mb-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {t('nutrient.dilutionGuidance')}
          </Text>
          <Text className="mb-1 text-sm text-neutral-700 dark:text-neutral-300">
            {formatDilution(guidance)}
          </Text>
        </>
      )}

      <View className="dark:bg-warning-950 mt-3 rounded-md border border-warning-200 bg-warning-50 p-2 dark:border-warning-800">
        <Text className="mb-1 text-xs font-semibold text-warning-800 dark:text-warning-200">
          {t('nutrient.safetyNotes')}
        </Text>
        {guidance.safetyNotes.map((note: string, idx: number) => (
          <Text
            key={idx}
            className="mb-1 text-xs text-warning-700 dark:text-warning-300"
          >
            • {note}
          </Text>
        ))}
      </View>
    </View>
  );
}

// eslint-disable-next-line max-lines-per-function
export function ReservoirCorrectionPanel({
  currentEc,
  targetEc,
  reservoirVolumeL,
  onClose,
  testID = 'reservoir-correction-panel',
}: ReservoirCorrectionPanelProps) {
  const { t } = useTranslation();
  const [stockConcentration, setStockConcentration] = React.useState('');
  const [showGuidance, setShowGuidance] = React.useState(false);

  const needsIncrease = currentEc < targetEc;
  const needsDecrease = currentEc > targetEc;

  const guidance = React.useMemo(() => {
    const stock = parseFloat(stockConcentration);
    if (isNaN(stock) || stock <= 0) return null;

    try {
      if (needsIncrease) {
        return calculateEcAdjustment(
          currentEc,
          targetEc,
          reservoirVolumeL,
          stock
        );
      } else if (needsDecrease) {
        return calculateDilution(currentEc, targetEc, reservoirVolumeL);
      }
    } catch {
      return null;
    }

    return null;
  }, [
    currentEc,
    targetEc,
    reservoirVolumeL,
    stockConcentration,
    needsIncrease,
    needsDecrease,
  ]);

  return (
    <View
      className="dark:bg-primary-950 rounded-lg border border-primary-200 bg-primary-50 p-4 dark:border-primary-800"
      testID={testID}
    >
      <Text className="mb-2 text-base font-semibold text-primary-900 dark:text-primary-100">
        {t('nutrient.ecCorrection')}
      </Text>

      <View className="dark:bg-warning-950 mb-3 rounded-md bg-warning-50 p-2">
        <Text className="text-xs text-warning-800 dark:text-warning-200">
          ⚠️ {t('nutrient.educationalGuidanceOnly')}
        </Text>
      </View>

      <CurrentReadings
        currentEc={currentEc}
        targetEc={targetEc}
        reservoirVolumeL={reservoirVolumeL}
      />

      {needsIncrease && (
        <Input
          label={t('nutrient.stockConcentration')}
          placeholder="e.g., 1.0"
          keyboardType="decimal-pad"
          value={stockConcentration}
          onChangeText={setStockConcentration}
          testID={`${testID}-stock-input`}
        />
      )}

      <Button
        label={
          showGuidance
            ? t('common.hide')
            : needsIncrease
              ? t('nutrient.calculateAddition')
              : t('nutrient.calculateDilution')
        }
        onPress={() => setShowGuidance(!showGuidance)}
        disabled={needsIncrease && !guidance}
        variant="outline"
        className="mt-3"
        testID={`${testID}-calculate-btn`}
      />

      {showGuidance && guidance && <GuidanceDisplay guidance={guidance} />}

      <Button
        label={t('common.close')}
        onPress={onClose}
        variant="ghost"
        className="mt-3"
        testID={`${testID}-close-btn`}
      />
    </View>
  );
}
