import { useColorScheme } from 'nativewind';
import * as React from 'react';
import type { SvgProps } from 'react-native-svg';
import Svg, { Path } from 'react-native-svg';

import colors from '@/components/ui/colors';

export const Play = ({ color, ...props }: SvgProps) => {
  const { colorScheme } = useColorScheme();
  const defaultColor =
    color ||
    (colorScheme === 'dark' ? colors.neutral[400] : colors.neutral[600]);
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" {...props}>
      <Path
        d="M6 4l15 8-15 8V4z"
        fill={defaultColor}
        stroke={defaultColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};
