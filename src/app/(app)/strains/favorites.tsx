import { useScrollToTop } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { Stack } from 'expo-router';
import React from 'react';
import { type ListRenderItemInfo, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

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
import { translate } from '@/lib';
import { useAnimatedScrollList } from '@/lib/animations/animated-scroll-list-provider';
import { useBottomTabBarHeight } from '@/lib/animations/use-bottom-tab-bar-height';
import { useNetworkStatus } from '@/lib/hooks';
import { parsePercentageRange } from '@/lib/strains/normalization';
import { useFavorites } from '@/lib/strains/use-favorites';
import type { FavoriteStrain } from '@/types/strains';

const LIST_HORIZONTAL_PADDING = 16;
const LIST_BOTTOM_EXTRA = 16;

const AnimatedFlashList = Animated.createAnimatedComponent(FlashList as any);

// Convert a display string (like "18-22%", "18%", "High") into a
// numeric representative used for sorting. Convention: if both min and max
// are available use the average; otherwise prefer min then max. If the value
// is qualitative or missing, return NaN so callers can treat it as unknown.
function numericRepresentativeFromTHCDisplay(
  thcDisplay: string | unknown
): number {
  const parsed = parsePercentageRange(thcDisplay);
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
    slug: '',
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

function FavoritesHeader({
  count,
  isOffline,
  onSort,
}: {
  count: number;
  isOffline: boolean;
  onSort: () => void;
}) {
  return (
    <View className="px-4 pb-4 pt-3">
      <View className="flex-row items-center justify-between">
        <Text
          className="text-sm text-neutral-600 dark:text-neutral-300"
          testID="favorites-count"
        >
          {translate('strains.results_count', {
            count,
          })}
        </Text>
        <Pressable
          onPress={onSort}
          className="flex-row items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
          accessibilityRole="button"
          accessibilityLabel={translate('strains.favorites.sort.title')}
          accessibilityHint={translate('strains.favorites.sort.hint')}
          testID="favorites-sort-button"
        >
          <Text className="text-sm text-neutral-900 dark:text-neutral-50">
            ⬍⬆⬍
          </Text>
        </Pressable>
      </View>
      <StrainsOfflineBanner isVisible={isOffline} />
    </View>
  );
}

// eslint-disable-next-line max-lines-per-function
export default function FavoritesScreen(): React.ReactElement {
  const { listRef, scrollHandler } = useAnimatedScrollList();
  useScrollToTop(listRef);
  const { grossHeight } = useBottomTabBarHeight();
  const { isConnected, isInternetReachable } = useNetworkStatus();

  const favorites = useFavorites.use.getFavorites()();
  const sortMenu = useFavoritesSortMenu();

  const isOffline = !isConnected || !isInternetReachable;

  const [sortBy, setSortBy] = React.useState<FavoritesSortBy>('dateAdded');
  const [sortDirection, setSortDirection] =
    React.useState<FavoritesSortDirection>('desc');

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
    ({ item }: ListRenderItemInfo<FavoriteStrain>) => (
      <FavoriteItem item={item} />
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
    <>
      <Stack.Screen
        options={{
          headerTitle: translate('strains.favorites.title'),
        }}
      />
      <View className="flex-1" testID="favorites-screen">
        <FocusAwareStatusBar />
        <FavoritesHeader
          count={favorites.length}
          isOffline={isOffline}
          onSort={sortMenu.openSort}
        />
        <AnimatedFlashList
          ref={listRef as React.RefObject<any>}
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
    </>
  );
}

const styles = StyleSheet.create({
  listContentContainer: {
    paddingHorizontal: LIST_HORIZONTAL_PADDING,
  },
});
