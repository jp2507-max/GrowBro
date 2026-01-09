import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import React from 'react';
import { StyleSheet } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import {
  HeaderIconButton,
  ScreenHeaderBase,
} from '@/components/navigation/screen-header-base';
import { GlassSurface } from '@/components/shared/glass-surface';
import { Input, Text, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import { Rate, Settings } from '@/components/ui/icons';
import { haptics } from '@/lib/haptics';
import { translate } from '@/lib/i18n';

const styles = StyleSheet.create({
  searchPill: {
    borderRadius: 16,
    overflow: 'hidden',
  },
});

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
      title=""
      showBottomBorder={false}
      topRowLeft={
        <Text className="text-2xl font-bold text-white">
          {translate('shared_header.strains.title')}
        </Text>
      }
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
            accessibilityHint={translate(
              'strains.favorites_accessibility_hint'
            )}
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
      {/* Search Row - Glass Pill Container */}
      <GlassSurface
        glassEffectStyle="clear"
        style={styles.searchPill}
        fallbackClassName="bg-white/90 dark:bg-neutral-900/90"
      >
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
          className="h-12 border-0 bg-transparent font-medium"
          placeholderTextColor={colors.neutral[400]}
        />
      </GlassSurface>
    </ScreenHeaderBase>
  );
}
