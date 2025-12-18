import * as React from 'react';
import type { SvgProps } from 'react-native-svg';
import Svg, { Circle, Path } from 'react-native-svg';

export function FlowerOutline({ color = '#000', ...props }: SvgProps) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" {...props}>
      <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={1.5} />
      <Path
        d="M12 2a3 3 0 0 0 0 6 3 3 0 0 0 0-6ZM19.07 4.93a3 3 0 1 0-4.24 4.24M22 12a3 3 0 0 0-6 0 3 3 0 0 0 6 0ZM19.07 19.07a3 3 0 1 0-4.24-4.24M12 22a3 3 0 0 0 0-6 3 3 0 0 0 0 6ZM4.93 19.07a3 3 0 1 0 4.24-4.24M2 12a3 3 0 0 0 6 0 3 3 0 0 0-6 0ZM4.93 4.93a3 3 0 1 0 4.24 4.24"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
