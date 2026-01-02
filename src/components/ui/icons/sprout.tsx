import * as React from 'react';
import type { SvgProps } from 'react-native-svg';
import Svg, { Path } from 'react-native-svg';

export function Sprout({ color = '#000', ...props }: SvgProps) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" {...props}>
      <Path
        d="M7 20h10M10 20c5.5-2.5.8-6.4 3-10M9.5 9.4c1.1.8 1.8 2.2 2.3 3.6M4.9 2.5c.7.4 1.5.8 2.3.8 2.2 0 4-1.8 4-4 0-1.7-1.3-3-3-3-.7 0-1.5.4-2.3.8C4.5 1.5 5 3.5 4.9 2.5zM14 6.5c-2.2 0-4 1.8-4 4 0 1.7 1.3 3 3 3 .7 0 1.5-.4 2.3-.8.7-.4 1.1-1.3.8-2 .4-.9-.1-1.8-.8-2-.8-.4-1.6-.2-2.3 0z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
