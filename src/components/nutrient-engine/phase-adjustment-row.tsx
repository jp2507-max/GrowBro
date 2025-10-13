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

// Custom hook for numeric input handling with intermediate states
function useNumericInput(
  initialValue: number,
  onChange: (value: number) => void
) {
  const [text, setText] = React.useState(initialValue.toString());
  const editingRef = React.useRef(false);

  // Sync local state with props when they change externally
  React.useEffect(() => {
    if (!editingRef.current) {
      setText(initialValue.toString());
    }
  }, [initialValue]);

  const handleChangeText = React.useCallback(
    (newText: string) => {
      editingRef.current = true;
      setText(newText);

      // Allow intermediate input states when typing
      if (
        newText === '' ||
        newText === '-' ||
        newText === '.' ||
        newText === '-.'
      ) {
        return; // Keep the text as-is without calling the callback
      }

      const val = parseFloat(newText);
      if (!isNaN(val)) {
        onChange(val);
      }
    },
    [onChange]
  );

  const handleBlur = React.useCallback(() => {
    editingRef.current = false;
    const val = parseFloat(text);
    if (isNaN(val)) {
      setText(initialValue.toString());
    }
  }, [text, initialValue]);

  return { text, handleChangeText, handleBlur };
}

export function PhaseAdjustmentRow({
  phase,
  phOffset,
  ecOffset,
  onPhOffsetChange,
  onEcOffsetChange,
  testID,
}: PhaseAdjustmentRowProps): React.JSX.Element {
  const { t } = useTranslation();

  const phInput = useNumericInput(phOffset, onPhOffsetChange);
  const ecInput = useNumericInput(ecOffset, onEcOffsetChange);

  return (
    <View
      className="rounded-lg border border-neutral-300 bg-white p-3 dark:border-neutral-700 dark:bg-charcoal-950"
      testID={testID}
    >
      <Text className="mb-2 font-medium capitalize text-neutral-700 dark:text-neutral-300">
        {t(`phases.${phase}`, { defaultValue: phase })}
      </Text>

      <View className="flex-row gap-2">
        <View className="flex-1">
          <Input
            label={t('nutrient.phOffset')}
            keyboardType="decimal-pad"
            value={phInput.text}
            onChangeText={phInput.handleChangeText}
            onBlur={phInput.handleBlur}
            placeholder="±0.0"
            testID={`${testID}-ph`}
          />
        </View>

        <View className="flex-1">
          <Input
            label={t('nutrient.ecOffset')}
            keyboardType="decimal-pad"
            value={ecInput.text}
            onChangeText={ecInput.handleChangeText}
            onBlur={ecInput.handleBlur}
            placeholder="±0.0"
            testID={`${testID}-ec`}
          />
        </View>
      </View>
    </View>
  );
}
