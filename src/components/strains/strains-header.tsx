import { useRouter } from 'expo-router';
import * as React from 'react';
import { StyleSheet } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { GlassButton, Pressable, Text, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import { PlatformIcon, Rate, Search } from '@/components/ui/icons';
import { haptics } from '@/lib/haptics';
import { translate } from '@/lib/i18n';

type StrainsHeaderProps = {
  insets: EdgeInsets;
  onSearchPress: () => void;
  onFiltersPress: () => void;
  hasActiveFilters: boolean;
  testID?: string;
};

/**
 * Header for the strains discovery screen with search and favorites buttons.
 */
export function StrainsHeader({
  insets,
  onSearchPress,
  onFiltersPress,
  hasActiveFilters,
  testID = 'strains-header',
}: StrainsHeaderProps): React.ReactElement {
  const router = useRouter();

  const handleFavoritesPress = React.useCallback(() => {
    haptics.selection();
    router.push('/strains/favorites');
  }, [router]);

  const handleSearchPress = React.useCallback(() => {
    haptics.selection();
    onSearchPress();
  }, [onSearchPress]);

  const handleFiltersPress = React.useCallback(() => {
    haptics.selection();
    onFiltersPress();
  }, [onFiltersPress]);

  const containerPaddingTop = insets.top > 0 ? 0 : 16;

  return (
    <View
      testID={testID}
      style={{ paddingTop: containerPaddingTop }}
      className="px-6 pb-4"
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <Text
            style={styles.catalogLabel}
            className="mb-1 text-xs font-medium uppercase tracking-widest opacity-80"
          >
            {translate('strains.header.catalog')}
          </Text>
          <Text className="text-3xl font-bold leading-none tracking-tight text-white">
            {translate('strains.header.discover')}
            {'\n'}
            {translate('strains.header.strains')}
          </Text>
        </View>

        <View className="flex-row items-center gap-2">
          {hasActiveFilters && (
            <Pressable
              onPress={handleFiltersPress}
              accessibilityRole="button"
              accessibilityLabel={translate('strains.filters.button_label')}
              accessibilityHint={translate('strains.filters.tap_to_filter')}
              className="relative"
            >
              <View
                style={styles.filterIndicator}
                className="size-2 rounded-full"
              />
            </Pressable>
          )}

          <GlassButton
            onPress={handleFavoritesPress}
            size={48}
            variant="circular"
            accessibilityLabel={translate('strains.favorites.title')}
            accessibilityHint={translate(
              'strains.favorites_accessibility_hint'
            )}
            testID={`${testID}-favorites-button`}
            fallbackClassName="bg-white/5 border border-white/10"
          >
            <PlatformIcon
              iosName="star"
              size={22}
              color={colors.white}
              fallback={<Rate color={colors.white} size={22} />}
            />
          </GlassButton>

          <GlassButton
            onPress={handleSearchPress}
            size={48}
            variant="circular"
            accessibilityLabel={translate('strains.search_button')}
            accessibilityHint={translate('strains.search_hint')}
            testID={`${testID}-search-button`}
            fallbackClassName="bg-white/5 border border-white/10"
          >
            <Search color={colors.white} size={22} />
          </GlassButton>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  catalogLabel: { color: colors.neon.lime },
  filterIndicator: {
    backgroundColor: colors.neon.lime,
    shadowColor: colors.neon.lime,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
  },
});
