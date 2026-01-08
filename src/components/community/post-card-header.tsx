/**
 * PostCardHeader - Row 1: Avatar + Name + Time + More Options
 * Used by PostCard component for the "Instagram Pro" clean design
 */

import React from 'react';

import { Pressable, Text, View } from '@/components/ui';
import { MoreHorizontal } from '@/components/ui/icons';
import { translate } from '@/lib/i18n';

import type { PressEvent } from './types';

export type PostCardHeaderProps = {
  displayUsername: string;
  relativeTime: string | null;
  onAuthorPress: (e: PressEvent) => void;
  isOwnPost: boolean;
  onOptionsPress: (e: PressEvent) => void;
  deletePending: boolean;
  moreIconColor: string;
  testID: string;
};

export function PostCardHeader({
  displayUsername,
  relativeTime,
  onAuthorPress,
  isOwnPost,
  onOptionsPress,
  deletePending,
  moreIconColor,
  testID,
}: PostCardHeaderProps) {
  return (
    <View className="flex-row items-center justify-between p-4">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={translate(
          'accessibility.community.view_author_profile',
          { author: displayUsername }
        )}
        accessibilityHint={translate(
          'accessibility.community.view_author_profile_hint'
        )}
        onPress={onAuthorPress}
        className="flex-row items-center gap-3"
        testID={`${testID}-author-button`}
      >
        {/* Avatar */}
        <View className="size-10 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900">
          <Text className="text-sm font-bold text-primary-600 dark:text-primary-300">
            {displayUsername.charAt(0).toUpperCase()}
          </Text>
        </View>
        {/* Name + Time */}
        <View>
          <Text className="text-sm font-bold text-neutral-900 dark:text-neutral-50">
            {displayUsername}
          </Text>
          {relativeTime && (
            <Text className="text-xs text-neutral-400 dark:text-neutral-500">
              {relativeTime}
            </Text>
          )}
        </View>
      </Pressable>

      {/* More Options */}
      {isOwnPost && (
        <Pressable
          onPress={onOptionsPress}
          disabled={deletePending}
          accessibilityRole="button"
          accessibilityLabel={translate('accessibility.community.post_options')}
          accessibilityHint={translate(
            'accessibility.community.post_options_hint'
          )}
          accessibilityState={{ disabled: deletePending }}
          className="p-2"
          testID={`${testID}-more-button`}
        >
          <MoreHorizontal size={20} color={moreIconColor} />
        </Pressable>
      )}
    </View>
  );
}
