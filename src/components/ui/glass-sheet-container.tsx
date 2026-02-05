import * as React from 'react';
import { StyleSheet, View } from 'react-native';

import {
  GlassSurface,
  type GlassSurfaceProps,
} from '@/components/shared/glass-surface';
import { SHEET_BORDER_RADIUS } from '@/lib/constants';
import { cn } from '@/lib/utils';

type GlassSheetContainerProps = Omit<GlassSurfaceProps, 'children'> & {
  children: React.ReactNode;
  className?: string;
};

const styles = StyleSheet.create({
  surface: {
    borderRadius: SHEET_BORDER_RADIUS,
    overflow: 'hidden',
  },
});

export function GlassSheetContainer({
  children,
  className,
  style,
  testID,
  ...surfaceProps
}: GlassSheetContainerProps): React.ReactElement {
  return (
    <GlassSurface
      glassEffectStyle="regular"
      style={[styles.surface, style]}
      fallbackClassName="bg-white dark:bg-charcoal-900"
      testID={testID}
      {...surfaceProps}
    >
      <View className={cn('flex-1 px-4 pb-6', className)}>{children}</View>
    </GlassSurface>
  );
}
