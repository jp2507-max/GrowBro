import * as React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';

import { GlassSurface } from '@/components/shared/glass-surface';
import { cn } from '@/lib/utils';

type GlassSheetContainerProps = {
  children: React.ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const styles = StyleSheet.create({
  surface: {
    borderRadius: 24,
  },
});

export function GlassSheetContainer({
  children,
  className,
  style,
  testID,
}: GlassSheetContainerProps): React.ReactElement {
  return (
    <GlassSurface
      glassEffectStyle="regular"
      style={[styles.surface, style]}
      fallbackClassName="bg-white dark:bg-charcoal-900"
      testID={testID}
    >
      <View className={cn('flex-1 px-4 pb-6', className)}>{children}</View>
    </GlassSurface>
  );
}
