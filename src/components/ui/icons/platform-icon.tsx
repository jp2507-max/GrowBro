/* eslint-disable simple-import-sort/imports */
import {
  SymbolView,
  type SFSymbol,
  type SymbolType,
  type SymbolWeight,
} from 'expo-symbols';
import * as React from 'react';
import type { ColorValue } from 'react-native';
import { Platform } from 'react-native';
import type { SvgProps } from 'react-native-svg';

import { cn } from '@/lib/utils';
/* eslint-enable simple-import-sort/imports */

type SvgIconProps = SvgProps & { className?: string; testID?: string };

type PlatformIconProps = {
  /** iOS SF Symbol name */
  iosName: SFSymbol;
  /** Fallback SVG icon for Android/Web */
  fallback: React.ReactElement<SvgIconProps>;
  /** Icon size (points). Defaults to 20. */
  size?: number;
  /** Tint color for iOS and SVG fallback. */
  color?: ColorValue;
  /** Symbol weight for iOS. */
  weight?: SymbolWeight;
  /** Symbol type for iOS. */
  type?: SymbolType;
  /** Additional className for the SVG fallback. */
  className?: string;
  /** Test ID for testing. */
  testID?: string;
};

export function PlatformIcon({
  iosName,
  fallback,
  size = 20,
  color,
  weight,
  type,
  className,
  testID,
}: PlatformIconProps): React.ReactElement {
  if (Platform.OS === 'ios') {
    return (
      <SymbolView
        name={iosName}
        size={size}
        tintColor={color}
        weight={weight}
        type={type}
        testID={testID}
      />
    );
  }

  const mergedProps: SvgIconProps = {
    width: size,
    height: size,
    ...(color ? { color } : {}),
    className: cn(fallback.props.className, className),
    testID,
  };

  return React.cloneElement<SvgIconProps>(fallback, mergedProps);
}
