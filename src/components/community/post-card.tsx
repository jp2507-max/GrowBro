/**
 * PostCard - Full-bleed card design
 *
 * Premium vertical card layout:
 * - 4:5 aspect ratio image as full-bleed background
 * - Gradient overlay from bottom (black/90 → transparent)
 * - Floating avatar chip (top-left)
 * - Floating action buttons (right side, near bottom)
 * - Content overlay (bottom): optional tag, caption, stats
 */

import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import React from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

import type { Post as ApiPost } from '@/api/posts';
import { GlassSurface } from '@/components/shared/glass-surface';
import { Image, Pressable, Text, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import {
  HelpCircle,
  Leaf,
  Lightbulb,
  MessageCircle,
  PlatformIcon,
} from '@/components/ui/icons';
import {
  communityPostHeroTag,
  sharedTransitionStyle,
} from '@/lib/animations/shared';
import { getCommunityImageProps } from '@/lib/community/image-optimization';
import type { CommunityPostCategory } from '@/lib/community/post-categories';
import { translate, type TxKeyPath } from '@/lib/i18n';

import { PostCardActions } from './post-card-actions';
import { PostCardAvatar } from './post-card-avatar';
import { PostOptionsSheet } from './post-options-sheet';
import { usePostCard } from './use-post-card';

const AnimatedImage = Animated.createAnimatedComponent(Image);

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 32;
const CARD_HEIGHT = CARD_WIDTH * 1.25;

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 24,
    overflow: 'hidden',
  },
  image: { ...StyleSheet.absoluteFillObject },
  shadow: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 8,
  },
  categoryBadge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
});

const GRADIENT_COLORS = [
  'rgba(0, 0, 0, 0.9)',
  'rgba(0, 0, 0, 0.2)',
  'transparent',
] as const;

type PostCardProps = {
  post: ApiPost;
  onDelete?: (postId: number | string, undoExpiresAt: string) => void;
  displayUsername?: string | null;
  enableSharedTransition?: boolean;
  onCardPressIn?: (postId: number | string) => void;
  testID?: string;
};

// Category badge configuration
const CATEGORY_BADGE_CONFIG: Record<
  CommunityPostCategory,
  { icon: 'leaf' | 'lightbulb' | 'help.circle' | 'chat'; labelKey: string }
> = {
  harvest: { icon: 'leaf', labelKey: 'community.categories.harvest' },
  equipment: { icon: 'lightbulb', labelKey: 'community.categories.equipment' },
  grow_tips: { icon: 'leaf', labelKey: 'community.categories.grow_tips' },
  problem_deficiency: {
    icon: 'help.circle',
    labelKey: 'community.categories.problem',
  },
  general: { icon: 'chat', labelKey: 'community.categories.general' },
};

// Category badge component
const CategoryBadge = React.memo(function CategoryBadge({
  category,
}: {
  category: CommunityPostCategory;
}) {
  const config = CATEGORY_BADGE_CONFIG[category];
  if (!config) return null;

  const iconFallbackMap = {
    leaf: Leaf,
    lightbulb: Lightbulb,
    'help.circle': HelpCircle,
    chat: MessageCircle,
  } as const;
  const IconComponent = iconFallbackMap[config.icon];
  const iosIconName =
    config.icon === 'leaf'
      ? 'leaf.fill'
      : config.icon === 'lightbulb'
        ? 'lightbulb.fill'
        : config.icon === 'help.circle'
          ? 'questionmark.circle.fill'
          : 'bubble.left.fill';

  return (
    <GlassSurface
      glassEffectStyle="clear"
      style={styles.categoryBadge}
      fallbackClassName="bg-neon-lime/90"
    >
      <View className="flex-row items-center gap-1.5">
        <PlatformIcon
          iosName={iosIconName}
          size={12}
          color={colors.black}
          fallback={<IconComponent size={12} color={colors.black} />}
        />
        <Text className="text-xs font-bold text-black">
          {translate(config.labelKey as TxKeyPath)}
        </Text>
      </View>
    </GlassSurface>
  );
});

// Content stats display
const PostCardContent = React.memo(function PostCardContent({
  post,
}: {
  post: ApiPost;
}) {
  const numberFormatter = React.useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        notation: 'compact',
        maximumFractionDigits: 1,
      }),
    []
  );
  const formatCount = (n: number) => numberFormatter.format(n);

  const category = post.category as CommunityPostCategory | undefined;

  return (
    <View className="gap-2">
      {/* Category badge */}
      {category && (
        <View className="flex-row">
          <CategoryBadge category={category} />
        </View>
      )}
      {/* Caption */}
      <Text
        className="text-base font-semibold leading-snug text-white"
        numberOfLines={2}
      >
        {post.body}
      </Text>
      {/* Hashtag/strain display */}
      {post.strain && (
        <Text className="text-sm font-medium text-neon-lime">
          #{post.strain}
        </Text>
      )}
      {/* Stats */}
      <Text className="text-sm font-medium text-white/60">
        {formatCount(post.like_count ?? 0)} {translate('community.likes')} •{' '}
        {formatCount(post.comment_count ?? 0)} {translate('community.comments')}
      </Text>
    </View>
  );
});

// Full-bleed image with shared transition
const PostCardImage = React.memo(function PostCardImage({
  post,
  postId,
  displayUsername,
  enableTransition,
  testID,
}: {
  post: ApiPost;
  postId: string;
  displayUsername: string;
  enableTransition: boolean;
  testID: string;
}) {
  const imageProps = React.useMemo(
    () =>
      getCommunityImageProps({
        uri: post.media_uri ?? '',
        thumbnailUri: post.media_thumbnail_uri,
        resizedUri: post.media_resized_uri,
        blurhash: post.media_blurhash,
        thumbhash: post.media_thumbhash,
        recyclingKey: post.media_thumbnail_uri || post.media_uri,
        transitionMs: 200,
      }),
    [
      post.media_uri,
      post.media_thumbnail_uri,
      post.media_resized_uri,
      post.media_blurhash,
      post.media_thumbhash,
    ]
  );

  if (!post.media_uri) {
    return (
      <LinearGradient
        colors={[colors.primary[900], colors.primary[950]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    );
  }

  return (
    <AnimatedImage
      style={styles.image}
      contentFit="cover"
      sharedTransitionTag={
        enableTransition ? communityPostHeroTag(postId) : undefined
      }
      sharedTransitionStyle={
        enableTransition ? sharedTransitionStyle : undefined
      }
      accessibilityIgnoresInvertColors
      accessibilityLabel={translate('accessibility.community.post_image', {
        author: displayUsername,
      })}
      accessibilityHint={translate(
        'accessibility.community.image_hint' as TxKeyPath
      )}
      testID={testID}
      {...imageProps}
    />
  );
});

// Main card component - uses extracted hook for logic
function PostCardComponent({
  post,
  onDelete,
  displayUsername: displayUsernameOverride,
  enableSharedTransition = true,
  onCardPressIn,
  testID,
}: PostCardProps): React.ReactElement {
  const {
    postId,
    postUserId,
    displayUsername,
    avatarUrl,
    isOwnPost,
    animatedStyle,
    onPressOut,
    handlePressIn,
    handleCommentPress,
    handleSharePress,
    optionsSheetRef,
    handleDeleteConfirm,
    deleteMutation,
  } = usePostCard({
    post,
    onDelete,
    displayUsernameOverride,
    onCardPressIn,
  });

  const resolvedTestID = testID ?? `post-card-${postId}`;

  return (
    <>
      <Animated.View style={animatedStyle}>
        <Link href={`/feed/${postId}`} asChild>
          <Pressable
            accessibilityHint={translate(
              'accessibility.community.open_post_hint'
            )}
            accessibilityLabel={
              post.body?.slice(0, 100) ||
              translate('accessibility.community.post_fallback' as TxKeyPath)
            }
            accessibilityRole="link"
            testID={resolvedTestID}
            onPressIn={handlePressIn}
            onPressOut={onPressOut}
          >
            <View className="mx-4 mb-6" style={styles.shadow}>
              <View
                style={styles.card}
                className="bg-charcoal-800 dark:bg-charcoal-900"
              >
                <PostCardImage
                  post={post}
                  postId={String(postId)}
                  displayUsername={displayUsername}
                  enableTransition={enableSharedTransition}
                  testID={`${resolvedTestID}-image`}
                />
                <LinearGradient
                  colors={GRADIENT_COLORS}
                  start={{ x: 0.5, y: 1 }}
                  end={{ x: 0.5, y: 0 }}
                  style={StyleSheet.absoluteFill}
                  pointerEvents="none"
                />
                <View className="absolute left-4 top-4">
                  <PostCardAvatar
                    userId={postUserId}
                    displayUsername={displayUsername}
                    avatarUrl={avatarUrl}
                    testID={`${resolvedTestID}-avatar`}
                  />
                </View>
                <View className="absolute right-4 top-1/3">
                  <PostCardActions
                    postId={String(postId)}
                    likeCount={post.like_count ?? 0}
                    userHasLiked={post.user_has_liked ?? false}
                    commentCount={post.comment_count ?? 0}
                    onCommentPress={handleCommentPress}
                    onSharePress={handleSharePress}
                    testID={`${resolvedTestID}-actions`}
                  />
                </View>
                <View className="absolute bottom-0 left-0 right-16 p-4">
                  <PostCardContent post={post} />
                </View>
              </View>
            </View>
          </Pressable>
        </Link>
      </Animated.View>
      {isOwnPost && (
        <PostOptionsSheet
          ref={optionsSheetRef}
          onDelete={handleDeleteConfirm}
          isDeleting={deleteMutation.isPending}
        />
      )}
    </>
  );
}

export const PostCard = React.memo(
  PostCardComponent,
  (prev, next) =>
    prev.post.id === next.post.id &&
    prev.post.body === next.post.body &&
    prev.post.media_uri === next.post.media_uri &&
    prev.post.like_count === next.post.like_count &&
    prev.post.comment_count === next.post.comment_count &&
    prev.post.user_has_liked === next.post.user_has_liked &&
    prev.post.created_at === next.post.created_at &&
    prev.post.strain === next.post.strain &&
    prev.onDelete === next.onDelete &&
    prev.displayUsername === next.displayUsername &&
    prev.enableSharedTransition === next.enableSharedTransition
);
