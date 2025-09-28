import React from 'react';
import { Platform } from 'react-native';

import { useDragDrop } from '@/components/calendar/drag-drop-provider';
import { Button, Text, View } from '@/components/ui';
import { translate } from '@/lib/i18n';

type TargetRanges = {
  phMin: number;
  phMax: number;
  ecMin25c: number;
  ecMax25c: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  anchorDate: Date;
  targets?: TargetRanges;
  onLogPress?: () => void;
};

function TargetsSection({
  targets,
  onLogPress,
}: {
  targets: TargetRanges;
  onLogPress?: () => void;
}): React.ReactElement {
  return (
    <View
      testID="targets-section"
      className="mb-3 rounded-md border border-neutral-200 p-3"
      accessibilityRole="summary"
      accessibilityLabel={translate('calendar.targets_title')}
      accessibilityHint={translate('accessibility.calendar.targets_hint')}
    >
      <Text className="mb-1 text-xs uppercase text-neutral-500">
        {translate('calendar.targets_title')}
      </Text>
      <Text testID="ph-range" className="text-sm text-neutral-900">
        {translate('calendar.ph_range', {
          min: targets.phMin.toFixed(1),
          max: targets.phMax.toFixed(1),
        })}
      </Text>
      <Text testID="ec-range" className="text-sm text-neutral-900">
        {translate('calendar.ec_range', {
          min: targets.ecMin25c.toFixed(2),
          max: targets.ecMax25c.toFixed(2),
        })}
      </Text>
      <View className="mt-2">
        <Button
          testID="log-measurement-button"
          label={translate('calendar.log_ph_ec')}
          variant="outline"
          onPress={onLogPress}
          accessibilityRole="button"
        />
      </View>
    </View>
  );
}

export function MoveToDateMenu({
  open,
  onClose,
  anchorDate,
  targets,
  onLogPress,
}: Props): React.ReactElement | null {
  const { completeDrop } = useDragDrop();
  const [selected, setSelected] = React.useState<Date>(anchorDate);

  const onConfirm = React.useCallback(async () => {
    await completeDrop(selected, 'occurrence');
    onClose();
  }, [completeDrop, onClose, selected]);

  if (!open) return null;

  // Minimal inline panel (can be wrapped with BottomSheetModal by caller)
  return (
    <View className="p-4">
      {targets ? (
        <TargetsSection targets={targets} onLogPress={onLogPress} />
      ) : null}
      <View className="flex-row justify-between py-2">
        <Button
          label={translate('calendar.yesterday')}
          variant="outline"
          onPress={() =>
            setSelected(
              (() => {
                const newDate = new Date(anchorDate);
                newDate.setDate(newDate.getDate() - 1);
                return newDate;
              })()
            )
          }
        />
        <Button
          label={translate('calendar.tomorrow')}
          variant="outline"
          onPress={() =>
            setSelected(
              (() => {
                const newDate = new Date(anchorDate);
                newDate.setDate(newDate.getDate() + 1);
                return newDate;
              })()
            )
          }
        />
      </View>
      <Button
        label={
          Platform.select({
            ios: translate('calendar.move'),
            android: translate('calendar.move'),
          }) as string
        }
        onPress={onConfirm}
      />
    </View>
  );
}
