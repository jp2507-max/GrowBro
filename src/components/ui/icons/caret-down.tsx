import * as React from 'react';
import type { SvgProps } from 'react-native-svg';
import Svg, { Path } from 'react-native-svg';

type IconProps = SvgProps & {
  size?: number;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: 'image';
};

export function CaretDown({
  size = 16,
  className,
  testID,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = 'image',
  ...props
}: IconProps): React.JSX.Element {
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
      className={className ?? 'text-neutral-700 dark:text-neutral-300'}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityRole={accessibilityRole}
      {...props}
    >
      <Path d="M6 9l6 6 6-6" />
    </Svg>
  );
}
