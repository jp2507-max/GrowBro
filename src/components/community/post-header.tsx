/**
 * PostHeader - Author row with avatar + optional strain pill
 */
import * as React from 'react';

import { Pressable, Text, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import { ChevronRight, Leaf } from '@/components/ui/icons';
import { translate, type TxKeyPath } from '@/lib/i18n';

type PostHeaderProps = {
  displayUsername: string;
  relativeTime: string | null;
  strain?: string | null;
  onAuthorPress: () => void;
  onStrainPress: () => void;
};

export function PostHeader({
  displayUsername,
  relativeTime,
  strain,
  onAuthorPress,
  onStrainPress,
}: PostHeaderProps): React.ReactElement {
  return (
    <>
      {/* Author Row - Premium Design */}
      <View className="mb-5 flex-row items-center justify-between">
        <Pressable
          onPress={onAuthorPress}
          testID="post-header-author-pressable"
          accessibilityRole="button"
          accessibilityLabel={translate(
            'accessibility.community.view_author_profile' as TxKeyPath,
            { author: displayUsername }
          )}
          accessibilityHint={translate(
            'accessibility.community.view_author_profile_hint' as TxKeyPath
          )}
          className="flex-row items-center gap-3"
        >
          {/* Avatar with Lime Glow Ring */}
          <View className="relative">
            <View className="absolute -inset-0.5 animate-pulse rounded-full bg-lime-400/30 dark:bg-lime-500/25" />
            <View className="size-12 items-center justify-center rounded-full border-2 border-lime-400 bg-charcoal-800 dark:border-lime-500 dark:bg-charcoal-900">
              <Text className="text-lg font-bold text-lime-400 dark:text-lime-400">
                {displayUsername.charAt(0).toUpperCase()}
              </Text>
            </View>
          </View>
          {/* Name + Time + Location */}
          <View className="gap-0.5">
            <Text className="text-base font-semibold text-neutral-900 dark:text-white">
              {displayUsername}
            </Text>
            {relativeTime && (
              <Text className="text-xs text-neutral-500 dark:text-neutral-400">
                {relativeTime}
              </Text>
            )}
          </View>
        </Pressable>

        {/* Follow Button - UI Placeholder */}
        <Pressable
          onPress={() => {
            // TODO: Implement follow functionality when backend supports it
          }}
          testID="post-header-follow-button"
          accessibilityRole="button"
          accessibilityLabel={translate('community.follow' as TxKeyPath)}
          accessibilityHint={translate(
            'accessibility.community.follow_hint' as TxKeyPath
          )}
          className="bg-primary h-8 items-center justify-center rounded-full px-5"
        >
          <Text className="text-xs font-bold uppercase tracking-wider text-charcoal-900">
            {translate('community.follow' as TxKeyPath)}
          </Text>
        </Pressable>
      </View>

      {/* Strain Link Pill - Enhanced */}
      {strain && (
        <Pressable
          onPress={onStrainPress}
          testID="post-header-strain-pressable"
          className="mb-5 flex-row items-center gap-2 self-start rounded-full border border-lime-500/30 bg-lime-500/10 px-3 py-2 dark:border-lime-500/20 dark:bg-lime-500/5"
          accessibilityRole="button"
          accessibilityLabel={translate(
            'accessibility.community.strain_label' as TxKeyPath,
            { strain }
          )}
          accessibilityHint={translate(
            'accessibility.community.view_strain_hint' as TxKeyPath
          )}
        >
          <View className="size-5 items-center justify-center rounded-full bg-lime-500/20 dark:bg-lime-500/15">
            <Leaf width={12} height={12} color={colors.lime[400]} />
          </View>
          <Text className="text-sm font-medium text-lime-600 dark:text-lime-400">
            {strain}
          </Text>
          <ChevronRight width={14} height={14} color={colors.lime[400]} />
        </Pressable>
      )}
    </>
  );
}
