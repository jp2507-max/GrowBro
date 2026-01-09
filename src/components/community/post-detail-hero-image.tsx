/**
 * PostDetailHeroImage - Hero image with shared element transition
 */

import * as React from 'react';
import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

import { Image, View } from '@/components/ui';
import {
  communityPostHeroTag,
  sharedTransitionStyle,
} from '@/lib/animations/shared';
import { getCommunityImageProps } from '@/lib/community/image-optimization';
import { translate, type TxKeyPath } from '@/lib/i18n';

const AnimatedImage = Animated.createAnimatedComponent(Image);

const styles = StyleSheet.create({
  heroImage: {
    aspectRatio: 4 / 3,
    width: '100%',
  },
});

type PostDetailHeroImageProps = {
  postId: string;
  mediaUri: string;
  thumbnailUri?: string | null;
  resizedUri?: string | null;
  blurhash?: string | null;
  thumbhash?: string | null;
  displayUsername: string;
};

export function PostDetailHeroImage({
  postId,
  mediaUri,
  thumbnailUri,
  resizedUri,
  blurhash,
  thumbhash,
  displayUsername,
}: PostDetailHeroImageProps): React.ReactElement {
  const imageProps = React.useMemo(() => {
    return getCommunityImageProps({
      uri: mediaUri,
      thumbnailUri,
      resizedUri,
      blurhash,
      thumbhash,
      recyclingKey: thumbnailUri || mediaUri,
    });
  }, [mediaUri, thumbnailUri, resizedUri, blurhash, thumbhash]);

  return (
    <View className="mb-4 overflow-hidden rounded-2xl shadow-sm">
      <AnimatedImage
        className="w-full"
        style={styles.heroImage}
        sharedTransitionTag={communityPostHeroTag(postId)}
        sharedTransitionStyle={sharedTransitionStyle}
        accessibilityIgnoresInvertColors
        accessibilityLabel={translate(
          'accessibility.community.post_image' as TxKeyPath,
          { author: displayUsername }
        )}
        accessibilityHint={translate(
          'accessibility.community.post_image_hint' as TxKeyPath
        )}
        {...imageProps}
      />
    </View>
  );
}
