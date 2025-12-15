import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import React from 'react';
import type { EdgeInsets } from 'react-native-safe-area-context';

import {
  HeaderIconButton,
  ScreenHeaderBase,
} from '@/components/navigation/screen-header-base';
import { Input, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import { Rate, Settings } from '@/components/ui/icons';
import { haptics } from '@/lib/haptics';
import { translate } from '@/lib/i18n';

type StrainsHeaderProps = {
  insets: EdgeInsets;
  searchValue: string;
  onSearchChange: (value: string) => void;
  strainCount: number;
  hasActiveFilters: boolean;
  onFiltersPress: () => void;
};

export function StrainsHeader({
  insets,
  searchValue,
  onSearchChange,
  strainCount,
  hasActiveFilters,
  onFiltersPress,
}: StrainsHeaderProps): React.ReactElement {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const iconColor = isDark ? colors.white : colors.neutral[900];

  const handleFavoritesPress = React.useCallback(() => {
    haptics.selection();
    router.push('/strains/favorites');
  }, [router]);

  const handleFiltersPress = React.useCallback(() => {
    haptics.selection();
    onFiltersPress();
  }, [onFiltersPress]);

  return (
    <ScreenHeaderBase
      insets={insets}
      title={translate('shared_header.strains.title')}
      showBottomBorder={false}
      topRowRight={
        <View className="flex-row items-center gap-1">
          <HeaderIconButton
            icon={
              <Rate
                color={iconColor}
                width={20}
                height={20}
                className="text-neutral-900 dark:text-white"
              />
            }
            onPress={handleFavoritesPress}
            accessibilityLabel={translate('strains.favorites.title')}
            accessibilityHint={translate('strains.favoritesAccessibilityHint')}
            testID="strains-favorites-button"
          />
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
            onPress={handleFiltersPress}
            accessibilityLabel={translate('strains.filters.button_label')}
            accessibilityHint={translate(
              'accessibility.strains.open_filters_hint'
            )}
            testID="strains-filter-button"
            isActive={hasActiveFilters}
          />
        </View>
      }
      testID="strains-header"
    >
      {/* Search Row */}
      <Input
        value={searchValue}
        onChangeText={onSearchChange}
        placeholder={
          strainCount > 0
            ? translate('strains.search_placeholder_count', {
                count: strainCount,
              })
            : translate('strains.search_placeholder')
        }
        accessibilityLabel={translate('strains.search_placeholder')}
        accessibilityHint={translate('accessibility.strains.search_hint')}
        testID="strains-search-input"
        className="h-12 rounded-2xl border-0 bg-white px-4 font-medium text-neutral-900 shadow-sm dark:bg-neutral-900 dark:text-white"
        placeholderTextColor={colors.neutral[400]}
      />
    </ScreenHeaderBase>
  );
}
