/**
 * PostCardHeroImage - Row 2: Hero Image - No text overlays
 * Used by PostCard component for the "Instagram Pro" clean design
 */

import React from 'react';
import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

import { Image } from '@/components/ui';
import { communityPostHeroTag } from '@/lib/animations/shared';
import { getCommunityImageProps } from '@/lib/community/image-optimization';
import { translate } from '@/lib/i18n';

const AnimatedImage = Animated.createAnimatedComponent(Image);

const styles = StyleSheet.create({
  image: {
    // 4:3 aspect ratio for clean visual-first design
    aspectRatio: 4 / 3,
    width: '100%',
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
      className="w-full"
      style={styles.image}
      sharedTransitionTag={
        enableSharedTransition ? communityPostHeroTag(postId) : undefined
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
