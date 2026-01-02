import { useColorScheme } from 'nativewind';
import React from 'react';
import type { EdgeInsets } from 'react-native-safe-area-context';

import {
  HeaderIconButton,
  HeaderSettingsButton,
  ScreenHeaderBase,
} from '@/components/navigation/screen-header-base';
import { Text, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import { Settings } from '@/components/ui/icons';
import { haptics } from '@/lib/haptics';
import { translate } from '@/lib/i18n';

type CommunityHeaderProps = {
  insets: EdgeInsets;
  postsCount: number;
  hasActiveFilters: boolean;
  onFilterPress: () => void;
};

function HeaderSubtitle({
  postsCount,
}: {
  postsCount: number;
}): React.ReactElement {
  const label =
    postsCount > 0
      ? translate('community.posts_count_other', { count: postsCount })
      : translate('shared_header.community.subtitle');

  return (
    <Text className="text-lg font-medium text-primary-200 dark:text-primary-300">
      {label}
    </Text>
  );
}

export function CommunityHeader({
  insets,
  postsCount,
  hasActiveFilters,
  onFilterPress,
}: CommunityHeaderProps): React.ReactElement {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const iconColor = isDark ? colors.white : colors.neutral[900];

  const handleFilterPress = React.useCallback(() => {
    haptics.selection();
    onFilterPress();
  }, [onFilterPress]);

  return (
    <ScreenHeaderBase
      insets={insets}
      topRowLeft={<HeaderSubtitle postsCount={postsCount} />}
      topRowRight={
        <View className="flex-row items-center gap-1">
          <HeaderIconButton
            icon={
              <Settings
                color={hasActiveFilters ? colors.primary[600] : iconColor}
                width={20}
                height={20}
                className={
                  hasActiveFilters
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-neutral-900 dark:text-white'
                }
              />
            }
            onPress={handleFilterPress}
            accessibilityLabel={translate('community.filters_label')}
            accessibilityHint={translate('community.filters_hint')}
            testID="community-filter-button"
            isActive={hasActiveFilters}
          />
          <HeaderSettingsButton />
        </View>
      }
      title={translate('shared_header.community.title')}
      testID="community-header"
    />
  );
}
