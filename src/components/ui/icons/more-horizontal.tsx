import * as React from 'react';
import type { SvgProps } from 'react-native-svg';
import Svg, { Circle } from 'react-native-svg';

type IconProps = SvgProps & {
  size?: number;
};

export const MoreHorizontal = ({
  color = '#000',
  size = 24,
  ...props
}: IconProps) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
      <Circle cx={12} cy={12} r={1.5} fill={color} />
      <Circle cx={6} cy={12} r={1.5} fill={color} />
      <Circle cx={18} cy={12} r={1.5} fill={color} />
    </Svg>
  );
};
