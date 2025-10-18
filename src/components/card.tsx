import { Link } from 'expo-router';
import React from 'react';

import type { Post } from '@/api';
import { LikeButton } from '@/components/community/like-button';
import { ModerationActions } from '@/components/moderation-actions';
import { Image, Pressable, Text, View } from '@/components/ui';
import { translate } from '@/lib';

type Props = Post;

const images = [
  'https://images.unsplash.com/photo-1489749798305-4fea3ae63d43?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1564507004663-b6dfb3c824d5?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1515386474292-47555758ef2e?auto=format&fit=crop&w=800&q=80',
  'https://plus.unsplash.com/premium_photo-1666815503002-5f07a44ac8fb?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1587974928442-77dc3e0dba72?auto=format&fit=crop&w=800&q=80',
];

export const Card = ({
  title,
  body,
  id,
  userId,
  like_count = 0,
  comment_count = 0,
  user_has_liked = false,
}: Props) => {
  const compositeLabel = React.useMemo(() => {
    const badgeText = translate('cannabis.educational_badge');
    const previewText = body?.slice(0, 100) || '';
    return `${badgeText}. ${title}. ${previewText}`;
  }, [title, body]);

  // Prevent like button from triggering navigation
  const handleLikePress = React.useCallback((e: any) => {
    e.stopPropagation();
    e.preventDefault();
  }, []);

  return (
    <Link href={`/feed/${id}`} asChild>
      <Pressable
        accessibilityHint={translate('accessibility.community.open_post_hint')}
        accessibilityLabel={compositeLabel}
        accessibilityRole="link"
      >
        <View className="m-2 overflow-hidden rounded-xl  border border-neutral-300 bg-white  dark:bg-neutral-900">
          <Image
            className="h-56 w-full overflow-hidden rounded-t-xl"
            contentFit="cover"
            source={{
              uri: images[Math.floor(Math.random() * images.length)],
            }}
          />

          <View className="p-2">
            <Text className="w-fit rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
              {translate('cannabis.educational_badge')}
            </Text>
            <Text className="py-3 text-2xl ">{title}</Text>
            <Text numberOfLines={3} className="leading-snug text-gray-600">
              {body}
            </Text>
            <View
              className="mt-3 flex-row items-center justify-between"
              testID={`post-actions-${id}`}
            >
              <Pressable accessibilityRole="button" onPress={handleLikePress}>
                <LikeButton
                  postId={String(id)}
                  likeCount={like_count}
                  userHasLiked={user_has_liked}
                  testID={`like-button-${id}`}
                />
              </Pressable>
              {comment_count > 0 && (
                <Text
                  className="text-sm text-neutral-600 dark:text-neutral-400"
                  testID={`comment-count-${id}`}
                >
                  {comment_count} {comment_count === 1 ? 'comment' : 'comments'}
                </Text>
              )}
            </View>
            <View className="mt-3" testID={`moderation-actions-post-${id}`}>
              <ModerationActions contentId={id} authorId={userId} />
            </View>
          </View>
        </View>
      </Pressable>
    </Link>
  );
};
