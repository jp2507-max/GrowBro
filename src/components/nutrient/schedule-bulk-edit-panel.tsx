/**
 * Schedule Bulk Edit Panel
 *
 * Controls for bulk shifting schedule with undo capability.
 * Allows ±N day adjustments to entire feeding schedule.
 *
 * Requirements: 1.8
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Input, Text, View } from '@/components/ui';

interface ScheduleBulkEditPanelProps {
  onShift: (days: number) => Promise<void>;
  onUndo: () => Promise<void>;
  canUndo: boolean;
  testID?: string;
}

export function ScheduleBulkEditPanel({
  onShift,
  onUndo,
  canUndo,
  testID = 'schedule-bulk-edit',
}: ScheduleBulkEditPanelProps) {
  const { t } = useTranslation();
  const [days, setDays] = React.useState('');
  const [shifting, setShifting] = React.useState(false);
  const [undoing, setUndoing] = React.useState(false);

  const handleShift = React.useCallback(async () => {
    const numDays = parseInt(days, 10);
    if (isNaN(numDays) || numDays === 0) return;

    setShifting(true);
    try {
      await onShift(numDays);
      setDays('');
    } finally {
      setShifting(false);
    }
  }, [days, onShift]);

  const handleUndo = React.useCallback(async () => {
    setUndoing(true);
    try {
      await onUndo();
    } finally {
      setUndoing(false);
    }
  }, [onUndo]);

  return (
    <View
      className="dark:bg-primary-950 rounded-lg border border-primary-200 bg-primary-50 p-4 dark:border-primary-800"
      testID={testID}
    >
      <Text className="mb-3 text-base font-semibold text-primary-900 dark:text-primary-100">
        {t('nutrient.bulkScheduleEdit')}
      </Text>

      <View className="mb-3 rounded-md bg-neutral-50 p-2 dark:bg-charcoal-900">
        <Text className="text-xs text-neutral-700 dark:text-neutral-300">
          {t('nutrient.bulkEditDescription')}
        </Text>
      </View>

      <View className="mb-3 flex-row items-end gap-2">
        <View className="flex-1">
          <Input
            label={t('nutrient.shiftDays')}
            placeholder="e.g., +3 or -2"
            keyboardType="numeric"
            value={days}
            onChangeText={setDays}
            testID={`${testID}-days-input`}
          />
        </View>
        <Button
          label={t('nutrient.shift')}
          onPress={handleShift}
          disabled={shifting || !days}
          className="mb-[2px]"
          testID={`${testID}-shift-btn`}
        />
      </View>

      {canUndo && (
        <Button
          label={t('common.undo')}
          onPress={handleUndo}
          disabled={undoing}
          variant="outline"
          testID={`${testID}-undo-btn`}
        />
      )}
    </View>
  );
}
