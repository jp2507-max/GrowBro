import * as React from 'react';
import type { SvgProps } from 'react-native-svg';
import Svg, { Path } from 'react-native-svg';

export const Flush = ({ color = '#111827', ...props }: SvgProps) => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" {...props}>
    <Path
      d="M4 10c0-3.314 2.686-6 6-6h4a6 6 0 1 1 0 12h-1v2h-2v-2H8a4 4 0 0 1-4-4Zm6-4a4 4 0 1 0 0 8h4a4 4 0 1 0 0-8h-4Z"
      fill={color}
    />
  </Svg>
);
