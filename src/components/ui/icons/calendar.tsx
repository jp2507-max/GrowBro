import * as React from 'react';
import type { SvgProps } from 'react-native-svg';
import Svg, { Path } from 'react-native-svg';

export function Calendar({ color = '#000', ...props }: SvgProps) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" {...props}>
      <Path
        d="M8 2V5M16 2V5M3.5 9.09H20.5M21 8.5V17C21 18.1046 20.1046 19 19 19H5C3.89543 19 3 18.1046 3 17V6C3 4.89543 3.89543 4 5 4H19C20.1046 4 21 4.89543 21 6V8.5ZM8 11H10V13H8V11ZM12 11H14V13H12V11ZM16 11H18V13H16V11ZM8 15H10V17H8V15ZM12 15H14V17H12V15Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
