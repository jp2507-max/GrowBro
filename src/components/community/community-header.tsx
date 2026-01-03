/**
 * CommunityHeader - Clean dark green header
 *
 * Features:
 * - Standard app dark green header background
 * - Large bold "Community" title
 * - Glass-style search/filter icon button
 * - Clean, minimal design matching Instagram-style feed
 */

import React from 'react';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { ScreenHeaderBase } from '@/components/navigation/screen-header-base';
import { Pressable, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import { Search } from '@/components/ui/icons';
import { haptics } from '@/lib/haptics';
import { translate } from '@/lib/i18n';

type CommunityHeaderProps = {
  insets: EdgeInsets;
  postsCount: number;
  hasActiveFilters: boolean;
  onFilterPress: () => void;
};

export function CommunityHeader({
  insets,
  postsCount: _postsCount,
  hasActiveFilters,
  onFilterPress,
}: CommunityHeaderProps): React.ReactElement {
  const handleFilterPress = React.useCallback(() => {
    haptics.selection();
    onFilterPress();
  }, [onFilterPress]);

  return (
    <ScreenHeaderBase
      insets={insets}
      topRowRight={
        <View className="relative">
          <Pressable
            onPress={handleFilterPress}
            accessibilityRole="button"
            accessibilityLabel={translate('community.filters_label')}
            accessibilityHint={translate('community.filters_hint')}
            testID="community-filter-button"
            className="size-10 items-center justify-center rounded-full bg-white/15 active:bg-white/25"
          >
            <Search size={20} color={colors.white} />
          </Pressable>
          {/* Active indicator dot */}
          {hasActiveFilters && (
            <View className="absolute -right-0.5 -top-0.5 size-3 rounded-full border-2 border-primary-800 bg-terracotta-500" />
          )}
        </View>
      }
      title={translate('community.title')}
      testID="community-header"
    />
  );
}
