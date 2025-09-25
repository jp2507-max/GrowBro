import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import React from 'react';
import { InteractionManager, Platform } from 'react-native';

import type { Post } from '@/api';
import { usePosts } from '@/api';
import { CannabisEducationalBanner } from '@/components/cannabis-educational-banner';
import { Card } from '@/components/card';
import {
  ActivityIndicator,
  FocusAwareStatusBar,
  ListEmptyState,
  Pressable,
  Text,
  View,
} from '@/components/ui';
import { useAnalytics } from '@/lib';
import { NoopAnalytics } from '@/lib/analytics';
import { useBottomTabBarHeight } from '@/lib/animations/use-bottom-tab-bar-height';
import { useScreenErrorLogger } from '@/lib/hooks';
import { translate } from '@/lib/i18n';
import { consentManager } from '@/lib/privacy/consent-manager';
import { useThemeConfig } from '@/lib/use-theme-config';

function getNow(): number {
  if (
    typeof performance !== 'undefined' &&
    typeof performance.now === 'function'
  ) {
    return performance.now();
  }

  return Date.now();
}

const BOTTOM_PADDING_EXTRA = 24;

function useHomeTti(isPending: boolean, isError: boolean, itemCount: number) {
  const analytics = useAnalytics();
  const startRef = React.useRef<number>(getNow());
  const hasLoggedRef = React.useRef(false);
  const hasConsented = consentManager.hasConsented('analytics');

  React.useEffect(() => {
    if (hasLoggedRef.current) return;
    const hasSettled = !isPending || isError || itemCount > 0;
    if (!hasSettled) return;

    const finalize = () => {
      if (hasLoggedRef.current) return;
      const duration = Math.max(0, getNow() - startRef.current);
      if (hasConsented && analytics !== NoopAnalytics) {
        void analytics.track('home_tti_ms', { ms: Math.round(duration) });
      }
      hasLoggedRef.current = true;
    };

    if (Platform.OS === 'web') {
      finalize();
      return;
    }

    const interaction = InteractionManager.runAfterInteractions(finalize);
    return () => {
      interaction?.cancel?.();
    };
  }, [isError, isPending, itemCount, analytics, hasConsented]);
}

function useHomeAnalyticsTracking(isPending: boolean, itemCount: number): void {
  const analytics = useAnalytics();
  const hasTrackedRef = React.useRef(false);
  const hasConsented = consentManager.hasConsented('analytics');

  React.useEffect(() => {
    if (hasTrackedRef.current) return;
    if (isPending) return;
    hasTrackedRef.current = true;
    const widgets: string[] = ['share_update_banner'];
    if (itemCount > 0) widgets.push('post_list');
    if (hasConsented && analytics !== NoopAnalytics) {
      void analytics.track('home_view', { widgets_shown: widgets });
    }
  }, [analytics, isPending, itemCount, hasConsented]);
}

const HomeListHeader = React.memo(function HomeListHeader({
  onShareUpdatePress,
}: {
  onShareUpdatePress: () => void;
}) {
  return (
    <View className="gap-4 px-4 pb-4">
      <Pressable
        className="flex-row items-center justify-between rounded-2xl bg-primary-600 p-4"
        accessibilityRole="button"
        accessibilityLabel={translate('home.share_update_cta')}
        accessibilityHint={translate('accessibility.home.share_update_hint')}
        onPress={onShareUpdatePress}
        testID="home-share-update-action"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <View className="flex-1 pr-4">
          <Text className="text-base font-semibold text-neutral-50">
            {translate('home.share_update_title')}
          </Text>
          <Text className="mt-1 text-sm text-neutral-100/80">
            {translate('home.share_update_subtitle')}
          </Text>
        </View>
        <Text className="text-sm font-semibold text-neutral-50">
          {translate('home.share_update_cta')}
        </Text>
      </Pressable>
      <CannabisEducationalBanner />
    </View>
  );
});

const HomeListEmpty = React.memo(function HomeListEmpty({
  isLoading,
}: {
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center gap-2 py-12">
        <ActivityIndicator testID="feed-loading-indicator" />
        <Text className="text-sm text-neutral-600 dark:text-neutral-300">
          {translate('community.loading')}
        </Text>
      </View>
    );
  }
  return (
    <ListEmptyState
      className="py-12"
      title={translate('community.list_empty_title')}
      body={translate('community.list_empty_body')}
    />
  );
});

function HomeErrorState({ onRetry }: { onRetry: () => void }) {
  const theme = useThemeConfig();
  return (
    <View
      className="flex-1 items-center justify-center gap-4 px-6"
      style={{ backgroundColor: theme.colors.background }}
      testID="feed-screen-error"
    >
      <FocusAwareStatusBar />
      <Text className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
        {translate('community.list_error_title')}
      </Text>
      <Text className="text-center text-sm text-neutral-600 dark:text-neutral-300">
        {translate('community.list_error_body')}
      </Text>
      <Pressable
        className="rounded-full bg-primary-600 px-6 py-2"
        accessibilityRole="button"
        accessibilityLabel={translate('community.list_retry')}
        accessibilityHint={translate('accessibility.common.retry_hint')}
        onPress={onRetry}
        testID="feed-error-retry"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text className="text-sm font-semibold text-neutral-50">
          {translate('community.list_retry')}
        </Text>
      </Pressable>
    </View>
  );
}

export default function Feed() {
  const router = useRouter();
  const theme = useThemeConfig();
  const { grossHeight } = useBottomTabBarHeight();
  const { data, isPending, isError, error, refetch } = usePosts();
  const listData = React.useMemo(() => data ?? [], [data]);

  useScreenErrorLogger(isError ? error : null, {
    screen: 'home',
    feature: 'home-feed',
    action: 'fetch',
    queryKey: 'posts',
    metadata: {
      itemCount: listData.length,
      isPending,
    },
  });

  useHomeTti(isPending, isError, listData.length);
  useHomeAnalyticsTracking(isPending, listData.length);

  const renderItem = React.useCallback(
    ({ item }: { item: Post }) => <Card {...item} />,
    []
  );
  const keyExtractor = React.useCallback((item: Post) => String(item.id), []);
  const onShareUpdatePress = React.useCallback(() => {
    router.push('/add-post');
  }, [router]);
  const onRetry = React.useCallback(() => {
    void refetch();
  }, [refetch]);
  const contentPaddingBottom = React.useMemo(
    () => ({ paddingBottom: grossHeight + BOTTOM_PADDING_EXTRA }),
    [grossHeight]
  );

  if (isError) {
    return <HomeErrorState onRetry={onRetry} />;
  }

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: theme.colors.background }}
      testID="feed-screen"
    >
      <FocusAwareStatusBar />
      <FlashList
        data={listData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={contentPaddingBottom}
        ListHeaderComponent={
          <HomeListHeader onShareUpdatePress={onShareUpdatePress} />
        }
        ListFooterComponent={<View style={{ height: BOTTOM_PADDING_EXTRA }} />}
        ListEmptyComponent={<HomeListEmpty isLoading={isPending} />}
      />
    </View>
  );
}
