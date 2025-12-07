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
import Animated, { FadeIn } from 'react-native-reanimated';
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
import { useBottomTabBarHeight } from '@/lib/animations/use-bottom-tab-bar-height';
import { haptics } from '@/lib/haptics';
import { useNetworkStatus } from '@/lib/hooks';
import { parsePercentageRange } from '@/lib/strains/normalization';
import { useFavorites } from '@/lib/strains/use-favorites';
import type { FavoriteStrain } from '@/types/strains';

const LIST_BOTTOM_EXTRA = 16;

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
      comparison = a.snapshot.name.localeCompare(b.snapshot.name);
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
  return {
    id: item.snapshot.id,
    name: item.snapshot.name,
    race: item.snapshot.race,
    thc_display: item.snapshot.thc_display,
    imageUrl: item.snapshot.imageUrl,
    // Fallback to ID for favorites saved before slug was added to snapshot
    slug: item.snapshot.slug || item.snapshot.id,
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

function FavoriteItem({ item }: { item: FavoriteStrain }) {
  const strain = createStrainFromSnapshot(item);
  return <StrainCard strain={strain} testID={`favorite-card-${item.id}`} />;
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

  const renderItem = React.useCallback(
    ({ item, index }: ListRenderItemInfo<FavoriteStrain>) => (
      <Animated.View
        entering={FadeIn.delay(index * 50)
          .springify()
          .damping(12)}
      >
        <FavoriteItem item={item} />
      </Animated.View>
    ),
    []
  );

  const keyExtractor = React.useCallback((item: FavoriteStrain) => item.id, []);

  const listEmpty = React.useMemo(() => <FavoritesEmptyState />, []);

  const listContentPadding = React.useMemo(
    () => ({ paddingBottom: grossHeight + LIST_BOTTOM_EXTRA }),
    [grossHeight]
  );

  return (
    <View
      className="flex-1 bg-neutral-50 dark:bg-neutral-950"
      testID="favorites-screen"
      style={{ paddingTop: insets.top }}
    >
      <FocusAwareStatusBar />

      <View className="px-4 py-2">
        {/* Back Button Row */}
        <View className="flex-row items-center pb-2">
          <Pressable
            onPress={() => {
              haptics.selection();
              router.back();
            }}
            className="size-10 items-center justify-center rounded-full bg-white shadow-sm active:bg-neutral-100 dark:bg-neutral-900 dark:active:bg-neutral-800"
            accessibilityRole="button"
            accessibilityLabel={translate('common.back')}
            accessibilityHint="Go back to previous screen"
            testID="favorites-back-button"
          >
            <ArrowLeft
              color={iconColor}
              width={16}
              height={16}
              className="text-neutral-900 dark:text-white"
            />
          </Pressable>
        </View>

        {/* Title and Sort Row */}
        <View className="flex-row items-center justify-between pb-4">
          <Text className="text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
            {translate('strains.favorites.title')}
          </Text>

          <Pressable
            onPress={() => {
              haptics.selection();
              sortMenu.openSort();
            }}
            className="size-10 items-center justify-center rounded-full bg-white shadow-sm active:bg-neutral-100 dark:bg-neutral-900 dark:active:bg-neutral-800"
            accessibilityRole="button"
            accessibilityLabel={translate('strains.favorites.sort.title')}
            accessibilityHint={translate('strains.favorites.sort.hint')}
            testID="favorites-sort-button"
          >
            <Settings
              color={iconColor}
              width={20}
              height={20}
              className="text-neutral-900 dark:text-white"
            />
          </Pressable>
        </View>

        <StrainsOfflineBanner isVisible={isOffline} />
      </View>

      <AnimatedFlashList
        ref={listRef}
        data={sortedFavorites}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemType={() => 'favorite'}
        estimatedItemSize={280}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        removeClippedSubviews={true}
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
