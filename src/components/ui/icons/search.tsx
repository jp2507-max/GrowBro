import type { SvgProps } from 'react-native-svg';
import Svg, { Circle, Line } from 'react-native-svg';

type IconProps = SvgProps & {
  size?: number;
};

export function Search({ size = 24, className, ...props }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <Circle cx="11" cy="11" r="8" />
      <Line x1="21" y1="21" x2="16.65" y2="16.65" />
    </Svg>
  );
}
