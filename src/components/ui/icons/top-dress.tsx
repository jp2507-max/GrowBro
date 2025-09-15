import * as React from 'react';
import type { SvgProps } from 'react-native-svg';
import Svg, { Path } from 'react-native-svg';

export const TopDress = ({ color = '#111827', ...props }: SvgProps) => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" {...props}>
    <Path
      d="M3 18h18l-2 3H5l-2-3Zm3-3h12l-1.5-3h-9L6 15Zm2-5h8l-1-2H9l-1 2Z"
      fill={color}
    />
  </Svg>
);
