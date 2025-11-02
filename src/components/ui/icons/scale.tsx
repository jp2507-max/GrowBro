import * as React from 'react';
import Svg, { Path, type SvgProps } from 'react-native-svg';

export const Scale = ({ color, ...props }: SvgProps) => (
  <Svg width={24} height={24} fill="none" viewBox="0 0 24 24" {...props}>
    <Path
      stroke={color}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 3v18m-5-7 5 2 5-2m-10 0 2-9m8 9-2-9m-8 9a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3m10 10a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3"
    />
  </Svg>
);
