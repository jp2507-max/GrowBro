import Svg, { Path } from 'react-native-svg';

type IconProps = {
  color?: string;
  size?: number;
};

export const Shield = ({ color = '#737373', size = 24 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
