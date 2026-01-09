import { useColorScheme } from 'nativewind';
import React from 'react';
import type { SvgProps } from 'react-native-svg';
import Svg, { Path } from 'react-native-svg';

import colors from '../colors';

interface SendProps extends SvgProps {
  accessibilityLabel?: string;
}

export const Send = ({ color, accessibilityLabel, ...props }: SendProps) => {
  const { colorScheme } = useColorScheme();
  const defaultColor =
    colorScheme === 'dark' ? colors.neutral[400] : colors.neutral[600];

  return (
    <Svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel || 'Send icon'}
      accessibilityHint="Sends or submits content"
      {...props}
    >
      <Path
        d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"
        stroke={color ?? defaultColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};
