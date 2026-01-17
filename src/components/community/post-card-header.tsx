/**
 * PostCardHeader - Row 1: Avatar + Name + Time + More Options
 * Premium "Deep Garden" design with larger avatar and verified badge
 */

import React from 'react';

import { Pressable, Text, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import { Check, MoreHorizontal } from '@/components/ui/icons';
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
  isVerified?: boolean;
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
  isVerified = false,
}: PostCardHeaderProps) {
  return (
    <View className="flex-row items-center justify-between px-4 py-3.5">
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
        className="flex-1 flex-row items-center gap-3"
        testID={`${testID}-author-button`}
      >
        {/* Avatar - larger and more prominent */}
        <View className="relative">
          <View className="size-11 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900">
            <Text className="text-base font-bold text-primary-600 dark:text-primary-300">
              {displayUsername.charAt(0).toUpperCase()}
            </Text>
          </View>
          {/* Verified badge */}
          {isVerified && (
            <View className="absolute -bottom-0.5 -right-0.5 size-5 items-center justify-center rounded-full border-2 border-white bg-primary-500 dark:border-charcoal-900">
              <Check size={10} color={colors.white} strokeWidth={3} />
            </View>
          )}
        </View>
        {/* Name + Time */}
        <View className="flex-1">
          <View className="flex-row items-center gap-1.5">
            <Text className="text-[15px] font-semibold text-neutral-900 dark:text-neutral-50">
              {displayUsername}
            </Text>
          </View>
          {relativeTime && (
            <Text className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
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
          className="ml-2 p-2"
          testID={`${testID}-more-button`}
        >
          <MoreHorizontal size={20} color={moreIconColor} />
        </Pressable>
      )}
    </View>
  );
}
