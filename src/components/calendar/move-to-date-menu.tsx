import React from 'react';
import { Platform } from 'react-native';

import { useDragDrop } from '@/components/calendar/drag-drop-provider';
import { Button, View } from '@/components/ui';

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
          label="Yesterday"
          variant="outline"
          onPress={() =>
            setSelected(
              new Date(
                anchorDate.getFullYear(),
                anchorDate.getMonth(),
                anchorDate.getDate() - 1
              )
            )
          }
        />
        <Button
          label="Tomorrow"
          variant="outline"
          onPress={() =>
            setSelected(
              new Date(
                anchorDate.getFullYear(),
                anchorDate.getMonth(),
                anchorDate.getDate() + 1
              )
            )
          }
        />
      </View>
      <Button
        label={Platform.select({ ios: 'Move', android: 'Move' }) as string}
        onPress={onConfirm}
      />
    </View>
  );
}
