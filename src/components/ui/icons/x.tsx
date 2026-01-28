import type { ReactElement } from 'react';
import Svg, { Line } from 'react-native-svg';

type IconProps = {
  color?: string;
  size?: number;
  testID?: string;
};

export const X = ({
  color = '#737373',
  size = 24,
  testID,
}: IconProps): ReactElement => (
  <Svg
    testID={testID}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
  >
    <Line
      x1="18"
      y1="6"
      x2="6"
      y2="18"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Line
      x1="6"
      y1="6"
      x2="18"
      y2="18"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
