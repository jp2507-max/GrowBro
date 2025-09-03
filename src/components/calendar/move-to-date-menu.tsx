import React from 'react';
import { Platform } from 'react-native';

import { useDragDrop } from '@/components/calendar/drag-drop-provider';
import { Button, View } from '@/components/ui';
import { translate } from '@/lib/i18n';

type Props = {
  open: boolean;
  onClose: () => void;
  anchorDate: Date;
};

export function MoveToDateMenu({
  open,
  onClose,
  anchorDate,
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
