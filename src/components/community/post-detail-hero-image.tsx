/**
 * PostDetailHeroImage - Full-bleed hero image with gradient overlay
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
    aspectRatio: 16 / 9,
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
    <View className="relative w-full overflow-hidden bg-charcoal-800">
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
      {/* Gradient overlay for text readability */}
      <View className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-charcoal-900 via-charcoal-900/60 to-transparent" />
    </View>
  );
}
