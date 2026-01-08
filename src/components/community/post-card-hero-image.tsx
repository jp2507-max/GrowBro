/**
 * PostCardHeroImage - Row 2: Hero Image - No text overlays
 * Used by PostCard component for the "Instagram Pro" clean design
 */

import React from 'react';
import { StyleSheet } from 'react-native';

import { OptimizedImage } from '@/components/ui';
import { translate } from '@/lib/i18n';

const styles = StyleSheet.create({
  image: {
    // 4:3 aspect ratio for clean visual-first design
    aspectRatio: 4 / 3,
    width: '100%' as const,
  },
});

export type PostCardHeroImageProps = {
  mediaUri: string;
  thumbnailUri?: string | null;
  resizedUri?: string | null;
  blurhash?: string | null;
  thumbhash?: string | null;
  displayUsername: string;
  testID: string;
};

export function PostCardHeroImage({
  mediaUri,
  thumbnailUri,
  resizedUri,
  blurhash,
  thumbhash,
  displayUsername,
  testID,
}: PostCardHeroImageProps) {
  return (
    <OptimizedImage
      className="w-full"
      style={styles.image}
      uri={mediaUri}
      thumbnailUri={thumbnailUri}
      resizedUri={resizedUri}
      blurhash={blurhash}
      thumbhash={thumbhash}
      recyclingKey={thumbnailUri || mediaUri}
      accessibilityIgnoresInvertColors
      accessibilityLabel={translate('accessibility.community.post_image', {
        author: displayUsername,
      })}
      accessibilityHint={translate('accessibility.community.post_image_hint')}
      testID={`${testID}-image`}
    />
  );
}
