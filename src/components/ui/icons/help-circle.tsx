import * as React from 'react';
import type { SvgProps } from 'react-native-svg';
import Svg, { Circle, Path } from 'react-native-svg';

import colors from '../colors';

type IconProps = SvgProps & {
  size?: number;
  strokeWidth?: number;
};

export const HelpCircle = ({
  color = colors.neutral[500],
  size = 24,
  strokeWidth = 1.5,
  ...props
}: IconProps): React.ReactElement => (
  <Svg width={size} height={size} fill="none" viewBox="0 0 24 24" {...props}>
    <Circle
      cx={12}
      cy={12}
      r={10}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3m.08 4h.01"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
