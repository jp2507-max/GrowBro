import * as React from 'react';
import Svg, { Path } from 'react-native-svg';

import type { IconProps } from './types';

export const Bookmark = ({
  size = 24,
  color = 'currentColor',
  strokeWidth = 2,
  ...rest
}: IconProps): React.ReactElement => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...rest}
  >
    <Path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
  </Svg>
);
