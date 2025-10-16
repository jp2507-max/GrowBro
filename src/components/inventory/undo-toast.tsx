/**
 * Undo Toast Component
 *
 * Displays a toast notification with undo action for destructive operations.
 * Auto-dismisses after 15 seconds (undo window expires).
 *
 * Requirements:
 * - 11.4: Undo affordances for destructive actions
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';
import { showMessage } from 'react-native-flash-message';

import { Text, View } from '@/components/ui';
import { executeUndo, isUndoAvailable } from '@/lib/inventory/undo-service';
import type { UndoInfo } from '@/types/inventory-errors';

interface UndoToastProps {
  undoInfo: UndoInfo;
  onUndoSuccess?: () => void;
  onUndoFail?: (error: string) => void;
}

/**
 * Show undo toast with 15-second window
 */
export function showUndoToast(props: UndoToastProps): void {
  const { undoInfo, onUndoSuccess, onUndoFail } = props;

  // Generate unique ID for this undo
  const undoId = `${undoInfo.action}-${undoInfo.performedAt.getTime()}`;

  // Calculate remaining time
  const remainingMs =
    undoInfo.expiresAt.getTime() - undoInfo.performedAt.getTime();

  showMessage({
    message: getUndoMessage(undoInfo.action),
    type: 'success',
    duration: remainingMs,
    floating: true,
    renderFlashMessageIcon: () => {
      return (
        <UndoActionButton
          undoId={undoId}
          _undoInfo={undoInfo}
          onSuccess={onUndoSuccess}
          onFail={onUndoFail}
        />
      );
    },
  });
}

/**
 * Undo action button component
 */
function UndoActionButton({
  undoId,
  _undoInfo,
  onSuccess,
  onFail,
}: {
  undoId: string;
  _undoInfo: UndoInfo;
  onSuccess?: () => void;
  onFail?: (error: string) => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const [isExecuting, setIsExecuting] = React.useState(false);

  const handleUndo = async () => {
    if (isExecuting) return;

    // Check if still available
    if (!isUndoAvailable(undoId)) {
      onFail?.(t('inventory.undo.expired'));
      return;
    }

    setIsExecuting(true);

    try {
      const result = await executeUndo(undoId);

      if (result.success) {
        showMessage({
          message: t('inventory.undo.success'),
          type: 'success',
          duration: 3000,
        });
        onSuccess?.();
      } else {
        showMessage({
          message: result.error ?? t('inventory.undo.failed'),
          type: 'danger',
          duration: 5000,
        });
        onFail?.(result.error ?? t('inventory.undo.failed'));
      }
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : t('inventory.undo.failed');
      showMessage({
        message: errorMsg,
        type: 'danger',
        duration: 5000,
      });
      onFail?.(errorMsg);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <View className="ml-auto">
      <Pressable
        accessibilityRole="button"
        onPress={handleUndo}
        disabled={isExecuting}
        className="rounded-md bg-white/20 px-3 py-1.5"
        testID="undo-button"
      >
        <Text className="text-sm font-semibold text-white">
          {isExecuting ? t('common.loading') : t('common.undo')}
        </Text>
      </Pressable>
    </View>
  );
}

/**
 * Get user-friendly message for undo action
 */
function getUndoMessage(action: UndoInfo['action']): string {
  switch (action) {
    case 'DELETE_BATCH':
      return 'Batch deleted';
    case 'ADJUST_INVENTORY':
      return 'Inventory adjusted';
    case 'DELETE_ITEM':
      return 'Item deleted';
    default:
      return 'Action completed';
  }
}
