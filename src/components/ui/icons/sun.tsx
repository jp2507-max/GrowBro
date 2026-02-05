import * as React from 'react';
import Svg, { Circle, Line } from 'react-native-svg';

import colors from '../colors';
import type { IconProps } from './types';

export const Sun = ({
  color = colors.neutral[500],
  size = 24,
  ...props
}: IconProps): React.JSX.Element => (
  <Svg width={size} height={size} fill="none" viewBox="0 0 24 24" {...props}>
    <Circle
      cx="12"
      cy="12"
      r="4"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Line
      x1="12"
      y1="2"
      x2="12"
      y2="4"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
    />
    <Line
      x1="12"
      y1="20"
      x2="12"
      y2="22"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
    />
    <Line
      x1="4.93"
      y1="4.93"
      x2="6.34"
      y2="6.34"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
    />
    <Line
      x1="17.66"
      y1="17.66"
      x2="19.07"
      y2="19.07"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
    />
    <Line
      x1="2"
      y1="12"
      x2="4"
      y2="12"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
    />
    <Line
      x1="20"
      y1="12"
      x2="22"
      y2="12"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
    />
    <Line
      x1="4.93"
      y1="19.07"
      x2="6.34"
      y2="17.66"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
    />
    <Line
      x1="17.66"
      y1="6.34"
      x2="19.07"
      y2="4.93"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
    />
  </Svg>
);
