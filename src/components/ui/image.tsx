/**
 * Base Image Component
 *
 * Use this component for:
 * - Local static assets (require('./image.png'))
 * - Simple local images (camera captures, picked photos)
 * - Situations where you explicitly DO NOT want the optimization/thumbnail logic
 *
 * This is a thin wrapper around expo-image that adds NativeWind (className) support.
 */
import type { ImageProps } from 'expo-image';
import { Image as NImage } from 'expo-image';
import { cssInterop } from 'nativewind';
import * as React from 'react';

export type ImgProps = ImageProps & {
  className?: string;
  testID?: string;
};

cssInterop(NImage, { className: 'style' });

export const Image = ({
  style,
  className,
  placeholder = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4',
  testID,
  ...props
}: ImgProps): React.JSX.Element => {
  return (
    <NImage
      className={className}
      placeholder={placeholder}
      style={style}
      testID={testID}
      {...props}
    />
  );
};

export const preloadImages = (sources: string[]): Promise<boolean> => {
  return NImage.prefetch(sources);
};
