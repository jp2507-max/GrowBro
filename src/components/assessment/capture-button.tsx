import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, useColorScheme } from 'react-native';

import { GlassSurface } from '@/components/shared/glass-surface';
import { Button, View } from '@/components/ui';
import colors from '@/components/ui/colors';

const styles = StyleSheet.create({
  glassButton: {
    padding: 8,
    borderRadius: 99,
  },
});

type CaptureButtonProps = {
  onPress: () => void;
  isCapturing: boolean;
};

export function CaptureButton({
  onPress,
  isCapturing,
}: CaptureButtonProps): JSX.Element {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const spinnerColor = colorScheme === 'dark' ? colors.white : colors.black;

  return (
    <View className="absolute inset-x-0 bottom-0 items-center pb-12">
      <GlassSurface
        isInteractive
        style={styles.glassButton}
        fallbackClassName="bg-white/20 dark:bg-charcoal-900/20"
      >
        <Button
          onPress={onPress}
          disabled={isCapturing}
          className="size-20 items-center justify-center rounded-full bg-neutral-100 dark:bg-charcoal-900"
          testID="capture-button"
          accessibilityRole="button"
          accessibilityLabel={t('assessment.camera.actions.capture')}
          accessibilityHint={t('assessment.camera.actions.capture_hint')}
        >
          {isCapturing ? (
            <View
              accessible={true}
              accessibilityLabel={t('assessment.camera.status.capturing')}
              accessibilityHint={t('assessment.camera.status.capturing_hint')}
              accessibilityRole="progressbar"
            >
              <ActivityIndicator size="small" color={spinnerColor} />
            </View>
          ) : (
            <View className="size-16 rounded-full border-4 border-charcoal-950 bg-neutral-100 dark:border-neutral-100 dark:bg-charcoal-900" />
          )}
        </Button>
      </GlassSurface>
    </View>
  );
}
