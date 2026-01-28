import { useScrollToTop } from '@react-navigation/native';
import {
  FlashList,
  type FlashListProps,
  type FlashListRef,
} from '@shopify/flash-list';
import { useNavigation, useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import React, { useLayoutEffect } from 'react';
import { type ListRenderItemInfo, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  FavoritesEmptyState,
  FavoritesSortMenu,
  StrainCard,
  StrainsOfflineBanner,
  useFavoritesSortMenu,
} from '@/components/strains';
import type {
  FavoritesSortBy,
  FavoritesSortDirection,
} from '@/components/strains/favorites-sort-menu';
import { FocusAwareStatusBar, Pressable, Text, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import { ArrowLeft, Settings } from '@/components/ui/icons';
import { translate } from '@/lib';
import { useAnimatedScrollList } from '@/lib/animations/animated-scroll-list-provider';
import { createStaggeredFadeIn } from '@/lib/animations/stagger';
import { useBottomTabBarHeight } from '@/lib/animations/use-bottom-tab-bar-height';
import { getMediumFlashListConfig } from '@/lib/flashlist-config';
import { haptics } from '@/lib/haptics';
import { useNetworkStatus } from '@/lib/hooks';
import { parsePercentageRange } from '@/lib/strains/normalization';
import { useFavorites } from '@/lib/strains/use-favorites';
import type { FavoriteStrain } from '@/types/strains';

const LIST_BOTTOM_EXTRA = 16;
const MAX_ENTERING_ANIMATIONS = 12;
const STAGGER_ANIMATIONS = Array.from(
  { length: MAX_ENTERING_ANIMATIONS },
  function (_, index): ReturnType<typeof createStaggeredFadeIn> {
    return createStaggeredFadeIn(index, {
      baseDelay: 0,
      staggerDelay: 50,
      duration: 300,
    });
  }
);

const AnimatedFlashList = Animated.createAnimatedComponent(
  FlashList as React.ComponentType<FlashListProps<FavoriteStrain>>
);

// Convert a display string (like "18-22%", "18%", "High") into a
// numeric representative used for sorting. Convention: if both min and max
// are available use the average; otherwise prefer min then max. If the value
// is qualitative or missing, return NaN so callers can treat it as unknown.
function numericRepresentativeFromTHCDisplay(
  thcDisplay: string | unknown
): number {
  const parsed = parsePercentageRange(
    thcDisplay as
      | string
      | number
      | { min?: number; max?: number; label?: string }
      | null
      | undefined
  );
  if (!parsed) return NaN;

  if (typeof parsed.min === 'number' && typeof parsed.max === 'number') {
    return (parsed.min + parsed.max) / 2;
  }
  if (typeof parsed.min === 'number') return parsed.min;
  if (typeof parsed.max === 'number') return parsed.max;
  return NaN;
}

function sortFavorites(
  favorites: FavoriteStrain[],
  sortBy: FavoritesSortBy,
  direction: FavoritesSortDirection
): FavoriteStrain[] {
  const sorted = [...favorites].sort((a, b) => {
    let comparison = 0;
    if (sortBy === 'dateAdded') {
      comparison = a.addedAt - b.addedAt;
    } else if (sortBy === 'name') {
      const nameA = a.snapshot.name || a.snapshot.slug || a.snapshot.id || '';
      const nameB = b.snapshot.name || b.snapshot.slug || b.snapshot.id || '';
      comparison = nameA.localeCompare(nameB);
    } else if (sortBy === 'thc') {
      const valA = numericRepresentativeFromTHCDisplay(a.snapshot.thc_display);
      const valB = numericRepresentativeFromTHCDisplay(b.snapshot.thc_display);

      const aUnknown = Number.isNaN(valA);
      const bUnknown = Number.isNaN(valB);

      // Always push unknowns to the end regardless of sort direction.
      if (aUnknown && bUnknown) {
        return 0;
      } else if (aUnknown) {
        return 1; // a after b
      } else if (bUnknown) {
        return -1; // a before b
      } else {
        // both known numbers — apply direction-sensitive comparison here
        comparison = direction === 'asc' ? valA - valB : valB - valA;
        // we've handled direction here, so return comparison directly
        return comparison;
      }
    }
    return direction === 'asc' ? comparison : -comparison;
  });
  return sorted;
}

function createStrainFromSnapshot(item: FavoriteStrain) {
  const fallbackSlug = item.snapshot.slug || item.snapshot.id;
  const fallbackName =
    item.snapshot.name || item.snapshot.slug || item.snapshot.id;

  return {
    id: item.snapshot.id,
    name: fallbackName,
    race: item.snapshot.race,
    thc_display: item.snapshot.thc_display,
    imageUrl: item.snapshot.imageUrl,
    // Fallback to ID for favorites saved before slug was added to snapshot
    slug: fallbackSlug,
    synonyms: [],
    link: '',
    description: [],
    genetics: { parents: [], lineage: '' },
    thc: {},
    cbd: {},
    cbd_display: '',
    effects: [],
    flavors: [],
    grow: {
      difficulty: 'beginner' as const,
      indoor_suitable: true,
      outdoor_suitable: true,
      flowering_time: {},
      yield: {},
      height: {},
    },
    source: {
      provider: '',
      updated_at: '',
      attribution_url: '',
    },
  };
}

function FavoriteItem({
  item,
  enableSharedTransition,
  onStartNavigation,
}: {
  item: FavoriteStrain;
  enableSharedTransition?: boolean;
  onStartNavigation?: (strainId: string) => void;
}) {
  const strain = createStrainFromSnapshot(item);
  return (
    <StrainCard
      strain={strain}
      testID={`favorite-card-${item.id}`}
      enableSharedTransition={enableSharedTransition}
      onStartNavigation={onStartNavigation}
    />
  );
}

type FavoritesHeaderProps = {
  iconColor: string;
  onBack: () => void;
  onSort: () => void;
  isOffline: boolean;
};

function FavoritesHeader({
  iconColor,
  onBack,
  onSort,
  isOffline,
}: FavoritesHeaderProps) {
  return (
    <View className="px-4 py-2">
      <View className="flex-row items-center pb-2">
        <Pressable
          onPress={onBack}
          className="size-10 items-center justify-center rounded-full bg-white shadow-sm active:bg-white dark:bg-charcoal-900"
          accessibilityRole="button"
          accessibilityLabel={translate('common.back')}
          accessibilityHint={translate('accessibility.common.back_hint')}
          testID="favorites-back-button"
        >
          <ArrowLeft
            color={iconColor}
            width={16}
            height={16}
            className="text-charcoal-900 dark:text-neutral-100"
          />
        </Pressable>
      </View>
      <View className="flex-row items-center justify-between pb-4">
        <Text className="text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-100">
          {translate('strains.favorites.title')}
        </Text>
        <Pressable
          onPress={onSort}
          className="size-10 items-center justify-center rounded-full bg-white shadow-sm active:bg-white dark:bg-charcoal-900"
          accessibilityRole="button"
          accessibilityLabel={translate('strains.favorites.sort.title')}
          accessibilityHint={translate('strains.favorites.sort.hint')}
          testID="favorites-sort-button"
        >
          <Settings
            color={iconColor}
            width={20}
            height={20}
            className="text-neutral-900 dark:text-neutral-100"
          />
        </Pressable>
      </View>
      <StrainsOfflineBanner isVisible={isOffline} />
    </View>
  );
}

export default function FavoritesScreen(): React.ReactElement {
  const { listRef: sharedListRef, scrollHandler } = useAnimatedScrollList();
  const listRef = React.useMemo(
    () => sharedListRef as React.RefObject<FlashListRef<FavoriteStrain>>,
    [sharedListRef]
  );
  // useScrollToTop accepts refs with scrollTo/scrollToOffset methods
  useScrollToTop(
    listRef as React.RefObject<{
      scrollToOffset: (params: { offset?: number; animated?: boolean }) => void;
    }>
  );
  const { grossHeight } = useBottomTabBarHeight();
  const { isConnected, isInternetReachable } = useNetworkStatus();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const iconColor = isDark ? colors.white : colors.neutral[900];

  const favorites = useFavorites.use.getFavorites()();
  const sortMenu = useFavoritesSortMenu();

  const isOffline = !isConnected || !isInternetReachable;

  const [sortBy, setSortBy] = React.useState<FavoritesSortBy>('dateAdded');
  const [sortDirection, setSortDirection] =
    React.useState<FavoritesSortDirection>('desc');

  // Hide default header to create a custom clean layout
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  const handleApplySort = React.useCallback(
    (newSortBy: FavoritesSortBy, newDirection: FavoritesSortDirection) => {
      setSortBy(newSortBy);
      setSortDirection(newDirection);
      sortMenu.closeSort();
    },
    [sortMenu]
  );

  const sortedFavorites = React.useMemo(
    () => sortFavorites(favorites, sortBy, sortDirection),
    [favorites, sortBy, sortDirection]
  );

  const [activeStrainId, setActiveStrainId] = React.useState<string | null>(
    null
  );

  const handleStrainPressIn = React.useCallback((strainId: string) => {
    setActiveStrainId(strainId);
  }, []);

  const flashListConfig = React.useMemo(() => getMediumFlashListConfig(), []);

  const renderItem = React.useCallback(
    ({ item, index }: ListRenderItemInfo<FavoriteStrain>) => (
      <Animated.View
        entering={
          index < MAX_ENTERING_ANIMATIONS
            ? STAGGER_ANIMATIONS[index]
            : undefined
        }
      >
        <FavoriteItem
          item={item}
          enableSharedTransition={item.id === activeStrainId}
          onStartNavigation={handleStrainPressIn}
        />
      </Animated.View>
    ),
    [activeStrainId, handleStrainPressIn]
  );

  const keyExtractor = React.useCallback((item: FavoriteStrain) => item.id, []);

  const listEmpty = React.useMemo(() => <FavoritesEmptyState />, []);

  const listContentPadding = React.useMemo(
    () => ({ paddingBottom: grossHeight + LIST_BOTTOM_EXTRA }),
    [grossHeight]
  );

  const handleBack = React.useCallback(() => {
    haptics.selection();
    router.back();
  }, [router]);

  const handleOpenSort = React.useCallback(() => {
    haptics.selection();
    sortMenu.openSort();
  }, [sortMenu]);

  return (
    <View
      className="flex-1 bg-neutral-50 dark:bg-charcoal-950"
      testID="favorites-screen"
      style={{ paddingTop: insets.top }}
    >
      <FocusAwareStatusBar />
      <FavoritesHeader
        iconColor={iconColor}
        onBack={handleBack}
        onSort={handleOpenSort}
        isOffline={isOffline}
      />

      <AnimatedFlashList
        ref={listRef}
        data={sortedFavorites}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemType={() => 'favorite'}
        onScroll={scrollHandler}
        scrollEventThrottle={flashListConfig.scrollEventThrottle}
        removeClippedSubviews={flashListConfig.removeClippedSubviews}
        drawDistance={flashListConfig.drawDistance}
        contentContainerStyle={[
          styles.listContentContainer,
          listContentPadding,
        ]}
        ListEmptyComponent={listEmpty}
      />
      <FavoritesSortMenu
        ref={sortMenu.ref}
        sortBy={sortBy}
        sortDirection={sortDirection}
        onApply={handleApplySort}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  listContentContainer: {
    paddingTop: 8,
  },
});
