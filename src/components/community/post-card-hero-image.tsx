/**
 * PostCardHeroImage - Row 2: Hero Image - No text overlays
 * Premium "Deep Garden" design with 4:5 aspect ratio (Instagram-like)
 */

import React from 'react';
import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

import { Image } from '@/components/ui';
import {
  communityPostHeroTag,
  sharedTransitionStyle,
} from '@/lib/animations/shared';
import { getCommunityImageProps } from '@/lib/community/image-optimization';
import { translate } from '@/lib/i18n';

const AnimatedImage = Animated.createAnimatedComponent(Image);

const styles = StyleSheet.create({
  image: {
    // Small square image for horizontal card layout
    width: 120,
    height: 120,
    borderRadius: 12,
  },
});

export type PostCardHeroImageProps = {
  postId: string;
  mediaUri: string;
  thumbnailUri?: string | null;
  resizedUri?: string | null;
  blurhash?: string | null;
  thumbhash?: string | null;
  displayUsername: string;
  enableSharedTransition?: boolean;
  testID: string;
};

export function PostCardHeroImage({
  postId,
  mediaUri,
  thumbnailUri,
  resizedUri,
  blurhash,
  thumbhash,
  displayUsername,
  enableSharedTransition,
  testID,
}: PostCardHeroImageProps): React.ReactElement {
  const imageProps = React.useMemo(
    () =>
      getCommunityImageProps({
        uri: mediaUri,
        thumbnailUri,
        resizedUri,
        blurhash,
        thumbhash,
        recyclingKey: thumbnailUri || mediaUri,
        transitionMs: 0,
      }),
    [mediaUri, thumbnailUri, resizedUri, blurhash, thumbhash]
  );

  return (
    <AnimatedImage
      style={styles.image}
      sharedTransitionTag={
        enableSharedTransition ? communityPostHeroTag(postId) : undefined
      }
      sharedTransitionStyle={
        enableSharedTransition ? sharedTransitionStyle : undefined
      }
      accessibilityIgnoresInvertColors
      accessibilityLabel={translate('accessibility.community.post_image', {
        author: displayUsername,
      })}
      accessibilityHint={translate('accessibility.community.post_image_hint')}
      testID={`${testID}-image`}
      {...imageProps}
    />
  );
}
