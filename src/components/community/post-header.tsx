/**
 * PostHeader - Author row with avatar + optional strain pill
 */
import * as React from 'react';

import { Pressable, Text, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import { ChevronRight, Leaf, MoreHorizontal } from '@/components/ui/icons';
import { translate, type TxKeyPath } from '@/lib/i18n';

type PostHeaderProps = {
  displayUsername: string;
  relativeTime: string | null;
  strain?: string | null;
  isDark: boolean;
  onAuthorPress: () => void;
  onStrainPress: () => void;
  onOptionsPress?: () => void;
};

export function PostHeader({
  displayUsername,
  relativeTime,
  strain,
  isDark,
  onAuthorPress,
  onStrainPress,
  onOptionsPress,
}: PostHeaderProps): React.ReactElement {
  return (
    <>
      {/* Author Row */}
      <View className="mb-4 flex-row items-center justify-between">
        <Pressable
          onPress={onAuthorPress}
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
          {/* Avatar */}
          <View className="size-12 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900">
            <Text className="text-lg font-bold text-primary-600 dark:text-primary-300">
              {displayUsername.charAt(0).toUpperCase()}
            </Text>
          </View>
          {/* Name + Time */}
          <View>
            <Text className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
              {displayUsername}
            </Text>
            {relativeTime && (
              <Text className="text-sm text-neutral-400">{relativeTime}</Text>
            )}
          </View>
        </Pressable>

        {/* More Options */}
        <Pressable
          onPress={onOptionsPress}
          accessibilityRole="button"
          accessibilityLabel={translate(
            'accessibility.community.post_options' as TxKeyPath
          )}
          accessibilityHint={translate(
            'accessibility.community.post_options_hint' as TxKeyPath
          )}
          className="p-2"
        >
          <MoreHorizontal width={20} height={20} color={colors.neutral[400]} />
        </Pressable>
      </View>

      {/* Strain Link Pill */}
      {strain && (
        <Pressable
          onPress={onStrainPress}
          className="mb-4 flex-row items-center self-start rounded-full bg-primary-50 px-3 py-2 dark:bg-primary-900/20"
          accessibilityRole="button"
          accessibilityLabel={`Strain: ${strain}`}
          accessibilityHint={translate(
            'accessibility.community.view_strain_hint' as TxKeyPath
          )}
        >
          <View className="size-6 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-800">
            <Leaf width={14} height={14} color={colors.primary[600]} />
          </View>
          <Text className="ml-2 text-sm font-bold text-primary-700 dark:text-primary-300">
            {strain}
          </Text>
          <ChevronRight
            width={16}
            height={16}
            color={isDark ? colors.primary[400] : colors.primary[600]}
          />
        </Pressable>
      )}
    </>
  );
}
