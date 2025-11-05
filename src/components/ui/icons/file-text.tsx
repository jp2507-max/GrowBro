import * as React from 'react';
import Svg, { Path, type SvgProps } from 'react-native-svg';

export const FileText = ({ color, ...props }: SvgProps) => (
  <Svg width={24} height={24} fill="none" viewBox="0 0 24 24" {...props}>
    <Path
      stroke={color}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8m-6-6 6 6m-6-6v6h6M16 13H8m8 4H8m2-8H8"
    />
  </Svg>
);
