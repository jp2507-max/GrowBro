import { useRouter } from 'expo-router';
import React, { memo } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  ReduceMotion,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConnectivityBanner } from '@/components/sync/connectivity-banner';
import { SyncStatus } from '@/components/sync/sync-status';
import { Text, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import { translate } from '@/lib';
import { useAnimatedScrollList } from '@/lib/animations/animated-scroll-list-provider';
import type { TxKeyPath } from '@/lib/i18n';
import { useThemeConfig } from '@/lib/use-theme-config';

type SharedHeaderProps = {
  rightComponent?: React.ReactNode;
  showConnectivity?: boolean;
  showSync?: boolean;
  title?: string;
  routeName: string;
};

const HEADER_TOP_SPACING = 12;
const DEFAULT_ROUTE_KEY = 'index';
const SHARED_TAB_HEIGHTS: Record<string, number> = {
  index: 132,
  calendar: 136,
  community: 156,
  plants: 136,
  strains: 148,
  search: 164,
};

const COLLAPSING_ROUTES = new Set(['index', 'community']);

type TabContentConfig = {
  titleKey: TxKeyPath;
  subtitleKey?: TxKeyPath;
};

const TAB_CONTENT_KEYS: Record<string, TabContentConfig> = {
  index: {
    titleKey: 'shared_header.home.title',
    subtitleKey: 'shared_header.home.subtitle',
  },
  calendar: {
    titleKey: 'shared_header.calendar.title',
    subtitleKey: 'shared_header.calendar.subtitle',
  },
  community: {
    titleKey: 'shared_header.community.title',
    subtitleKey: 'shared_header.community.subtitle',
  },
  plants: {
    titleKey: 'shared_header.plants.title',
    subtitleKey: 'shared_header.plants.subtitle',
  },
  strains: {
    titleKey: 'shared_header.strains.title',
    subtitleKey: 'shared_header.strains.subtitle',
  },
};

export const SharedHeader = memo(function SharedHeader({
  rightComponent,
  showConnectivity = true,
  showSync = true,
  title,
  routeName,
}: SharedHeaderProps): React.ReactElement {
  const router = useRouter();
  const theme = useThemeConfig();
  const insets = useSafeAreaInsets();
  const { listOffsetY, offsetYAnchorOnBeginDrag, scrollDirection } =
    useAnimatedScrollList();
  const routeKey = routeName.toLowerCase();
  const { animatedContainerStyle } = useSharedHeaderAnimation({
    insetsTop: insets.top,
    routeKey,
    listOffsetY,
    offsetYAnchorOnBeginDrag,
    scrollDirection,
  });

  const onConnectivityPress = React.useCallback(() => {
    router.push('/sync-diagnostics');
  }, [router]);

  return (
    <Animated.View
      className="gap-3"
      style={[
        {
          paddingTop: insets.top + HEADER_TOP_SPACING,
          backgroundColor: theme.colors.card,
        },
        animatedContainerStyle,
      ]}
      layout={LinearTransition.springify().reduceMotion(ReduceMotion.System)}
    >
      <HeaderTopRow rightComponent={rightComponent} title={title} />
      <HeaderPerTabContent
        onConnectivityPress={onConnectivityPress}
        showConnectivity={showConnectivity}
        showSync={showSync}
        routeKey={routeName.toLowerCase()}
      />
    </Animated.View>
  );
});

function useSharedHeaderAnimation({
  insetsTop,
  routeKey,
  listOffsetY,
  offsetYAnchorOnBeginDrag,
  scrollDirection,
}: {
  insetsTop: number;
  routeKey: string;
  listOffsetY: SharedValue<number>;
  offsetYAnchorOnBeginDrag: SharedValue<number>;
  scrollDirection: SharedValue<'to-top' | 'to-bottom' | 'idle'>;
}) {
  const height = useSharedValue(
    SHARED_TAB_HEIGHTS[DEFAULT_ROUTE_KEY] + insetsTop + HEADER_TOP_SPACING
  );
  const translateY = useSharedValue(0);
  const isCollapsible = COLLAPSING_ROUTES.has(routeKey);

  React.useEffect(() => {
    const baseHeight =
      SHARED_TAB_HEIGHTS[routeKey] ?? SHARED_TAB_HEIGHTS[DEFAULT_ROUTE_KEY];
    const target = baseHeight + insetsTop + HEADER_TOP_SPACING;
    height.value = withSpring(target, {
      damping: 22,
      stiffness: 240,
      mass: 0.9,
    });
  }, [height, insetsTop, routeKey]);

  useDerivedValue(() => {
    if (!isCollapsible) {
      translateY.value = 0;
      return;
    }
    const currentHeight =
      SHARED_TAB_HEIGHTS[routeKey] ?? SHARED_TAB_HEIGHTS[DEFAULT_ROUTE_KEY];
    const maxOffset = currentHeight + HEADER_TOP_SPACING + insetsTop;
    const anchor = Math.max(offsetYAnchorOnBeginDrag.value, 0);
    const delta = Math.max(listOffsetY.value - anchor, 0);
    if (scrollDirection.value === 'to-bottom') {
      translateY.value = -Math.min(delta, maxOffset);
      return;
    }
    translateY.value = -Math.max(maxOffset - listOffsetY.value, 0);
  }, [
    insetsTop,
    isCollapsible,
    offsetYAnchorOnBeginDrag,
    routeKey,
    scrollDirection,
    listOffsetY,
    translateY,
  ]);

  const animatedContainerStyle = useAnimatedStyle(() => ({
    height: height.value,
    transform: [{ translateY: translateY.value }],
    opacity: isCollapsible ? 1 + translateY.value / (height.value || 1) : 1,
  }));

  return { animatedContainerStyle } as const;
}

function HeaderTopRow({
  rightComponent,
  title,
}: {
  rightComponent?: React.ReactNode;
  title?: string;
}): React.ReactElement {
  const theme = useThemeConfig();
  const heading = title ?? translate('shared_header.app_title');

  return (
    <View className="flex-row items-center justify-between px-5">
      <Text
        className="text-lg font-semibold"
        style={{ color: theme.colors.text }}
      >
        {heading}
      </Text>
      {rightComponent}
    </View>
  );
}

function HeaderPerTabContent({
  onConnectivityPress,
  showConnectivity,
  showSync,
  routeKey,
}: {
  onConnectivityPress: () => void;
  showConnectivity: boolean;
  showSync: boolean;
  routeKey: string;
}): React.ReactElement {
  const theme = useThemeConfig();
  const isDark = theme.colors.background === colors.charcoal[950];
  const syncSurface = isDark ? colors.charcoal[800] : colors.neutral[100];

  return (
    <View className="gap-2 px-5 pb-4">
      {showConnectivity ? (
        <ConnectivityBanner
          className="rounded-xl"
          onPress={onConnectivityPress}
          testID="shared-header-connectivity-banner"
        />
      ) : null}
      {showSync ? (
        <View
          className="rounded-xl px-3 py-2"
          style={{ backgroundColor: syncSurface }}
        >
          <SyncStatus testID="shared-header-sync-status" />
        </View>
      ) : null}
      <AnimatedPerTabContent routeKey={routeKey} />
    </View>
  );
}

function AnimatedPerTabContent({
  routeKey,
}: {
  routeKey: string;
}): React.ReactElement | null {
  const content = TAB_CONTENT_KEYS[routeKey];

  if (!content) return null;

  return (
    <Animated.View
      key={routeKey}
      entering={FadeIn.duration(180).reduceMotion(ReduceMotion.System)}
      exiting={FadeOut.duration(140).reduceMotion(ReduceMotion.System)}
      layout={LinearTransition.springify().reduceMotion(ReduceMotion.System)}
      className="gap-1"
    >
      <Text
        className="text-base font-semibold text-neutral-900 dark:text-neutral-100"
        tx={content.titleKey}
      />
      {content.subtitleKey ? (
        <Text
          className="text-sm text-neutral-600 dark:text-neutral-300"
          tx={content.subtitleKey}
        />
      ) : null}
    </Animated.View>
  );
}
