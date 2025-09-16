import * as React from 'react';
import type { SvgProps } from 'react-native-svg';
import Svg, { Path } from 'react-native-svg';

export const Feeding = ({ color = '#111827', ...props }: SvgProps) => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" {...props}>
    <Path
      d="M12 2c3.866 0 7 3.134 7 7 0 5-7 13-7 13S5 14 5 9c0-3.866 3.134-7 7-7Zm0 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
      fill={color}
    />
  </Svg>
);
