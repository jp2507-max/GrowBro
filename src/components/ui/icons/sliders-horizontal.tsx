import * as React from 'react';
import Svg, { Path } from 'react-native-svg';

import colors from '../colors';
import type { IconProps } from './types';

export const SlidersHorizontal = ({
  color = colors.neutral[500],
  size = 24,
  ...props
}: IconProps): React.JSX.Element => (
  <Svg width={size} height={size} fill="none" viewBox="0 0 24 24" {...props}>
    <Path
      d="M21 4h-7M10 4H3M21 12h-5M12 12H3M21 20h-3M14 20H3M7 1v6M14 9v6M18 17v6"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
