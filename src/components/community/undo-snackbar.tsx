/**
 * UndoSnackbar component
 *
 * Global snackbar for showing undo countdown on deletions:
 * - Displays countdown timer (15 seconds)
 * - Undo button to restore content
 * - Auto-dismisses when timer expires
 * - Works cross-device via server-side undo_expires_at
 */

import React from 'react';
import Animated, {
  FadeIn,
  FadeOut,
  ReduceMotion,
} from 'react-native-reanimated';

import { Button, Pressable, Text, View } from '@/components/ui';
import { translate } from '@/lib/i18n';

interface UndoSnackbarProps {
  visible: boolean;
  message: string;
  expiresAt: string;
  onUndo: () => void;
  onDismiss: () => void;
  testID?: string;
}

export function UndoSnackbar({
  visible,
  message,
  expiresAt,
  onUndo,
  onDismiss,
  testID = 'undo-snackbar',
}: UndoSnackbarProps): React.ReactElement | null {
  const [remainingSeconds, setRemainingSeconds] = React.useState(0);

  React.useEffect(() => {
    if (!visible) return;

    const updateCountdown = () => {
      const now = Date.now();
      const expiresAtMs = new Date(expiresAt).getTime();
      const diffMs = expiresAtMs - now;
      const seconds = Math.max(0, Math.ceil(diffMs / 1000));
      setRemainingSeconds(seconds);

      if (seconds === 0) {
        onDismiss();
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [visible, expiresAt, onDismiss]);

  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeIn.springify()
        .damping(22)
        .stiffness(180)
        .reduceMotion(ReduceMotion.System)}
      exiting={FadeOut.duration(250)}
      className="absolute inset-x-4 bottom-20 z-[1000]"
      testID={testID}
    >
      <View className="flex-row items-center justify-between rounded-lg bg-neutral-900 p-4 shadow-lg dark:bg-neutral-800">
        <View className="flex-1">
          <Text
            className="text-sm text-white dark:text-neutral-100"
            testID={`${testID}-message`}
          >
            {message}
          </Text>
          <Text
            className="mt-1 text-xs text-neutral-400 dark:text-neutral-500"
            testID={`${testID}-countdown`}
          >
            {translate('community.undo_expires', { seconds: remainingSeconds })}
          </Text>
        </View>

        <View className="ml-3 flex-row items-center gap-2">
          <Button
            label="Undo"
            onPress={onUndo}
            size="sm"
            variant="secondary"
            testID={`${testID}-undo-button`}
          />
          <Pressable
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
            accessibilityHint="Dismiss the undo snackbar and cancel the action"
            testID={`${testID}-dismiss-button`}
          >
            <Text className="text-sm text-neutral-400 dark:text-neutral-500">
              ✕
            </Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}
