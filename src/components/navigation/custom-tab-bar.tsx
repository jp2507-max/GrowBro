import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';

import { colors, Pressable, View } from '@/components/ui';
import {
  Calendar as CalendarIcon,
  Feed as FeedIcon,
  Home as HomeIcon,
  Rate as StrainsIcon,
  TopDress as PlantsIcon,
} from '@/components/ui/icons';
import { useAnimatedScrollList } from '@/lib/animations/animated-scroll-list-provider';
import { useBottomTabBarHeight } from '@/lib/animations/use-bottom-tab-bar-height';
import type { TxKeyPath } from '@/lib/i18n';
import { translate } from '@/lib/i18n';
import { useThemeConfig } from '@/lib/use-theme-config';

const DURATION = 300;

type TabRoute = 'index' | 'calendar' | 'community' | 'plants' | 'strains';

type IconComponent = React.ComponentType<{ color?: string }>;

type TabItem = {
  readonly route: TabRoute;
  readonly Icon: IconComponent;
  readonly testID: string;
  readonly iconTestID: string;
  readonly labelKey: TxKeyPath;
  readonly hintKey: TxKeyPath;
};

const TAB_ITEMS: readonly TabItem[] = [
  {
    route: 'index',
    Icon: HomeIcon,
    testID: 'home-tab',
    iconTestID: 'home-icon',
    labelKey: 'tabs.home',
    hintKey: 'accessibility.tabs.home_hint',
  },
  {
    route: 'calendar',
    Icon: CalendarIcon,
    testID: 'calendar-tab',
    iconTestID: 'calendar-icon',
    labelKey: 'tabs.calendar',
    hintKey: 'accessibility.tabs.calendar_hint',
  },
  {
    route: 'community',
    Icon: FeedIcon,
    testID: 'community-tab',
    iconTestID: 'community-icon',
    labelKey: 'tabs.community',
    hintKey: 'accessibility.tabs.community_hint',
  },
  {
    route: 'plants',
    Icon: PlantsIcon,
    testID: 'plants-tab',
    iconTestID: 'plants-icon',
    labelKey: 'tabs.plants',
    hintKey: 'accessibility.tabs.plants_hint',
  },
  {
    route: 'strains',
    Icon: StrainsIcon,
    testID: 'strains-tab',
    iconTestID: 'strains-icon',
    labelKey: 'tabs.strains',
    hintKey: 'accessibility.tabs.strains_hint',
  },
] as const;

export function handleTabPress(
  navigation: BottomTabBarProps['navigation'],
  state: BottomTabBarProps['state'],
  routeName: string
) {
  const route = state.routes.find((r) => r.name === routeName);
  if (!route) return;

  const isFocused = state.index === state.routes.indexOf(route);

  // Emit tabPress event to allow listeners to prevent navigation
  const event = navigation.emit({
    type: 'tabPress',
    target: route.key,
    canPreventDefault: true,
  });

  // Only navigate if event wasn't prevented and tab isn't already focused
  if (!isFocused && !event.defaultPrevented) {
    navigation.navigate(routeName);
  }
}

export function CustomTabBar({
  navigation,
  state,
}: BottomTabBarProps): React.ReactElement {
  const { grossHeight } = useBottomTabBarHeight();
  const { listOffsetY, offsetYAnchorOnBeginDrag, scrollDirection } =
    useAnimatedScrollList();
  const theme = useThemeConfig();
  const activeColor = theme.colors.primary;
  const inactiveColor = theme.dark ? colors.neutral[300] : colors.neutral[600];
  const containerStyle = React.useMemo(
    () => ({
      backgroundColor: theme.colors.card,
      borderTopColor: theme.colors.border,
    }),
    [theme.colors.border, theme.colors.card]
  );

  const rContainerStyle = useAnimatedStyle(() => {
    const shouldHide =
      listOffsetY.value >= offsetYAnchorOnBeginDrag.value &&
      scrollDirection.value === 'to-bottom';

    return {
      bottom: withTiming(shouldHide ? -grossHeight : 0, { duration: DURATION }),
    };
  }, [grossHeight]);

  const currentRoute = state.routes[state.index]?.name;

  return (
    <Animated.View
      testID="custom-tab-bar"
      className="absolute inset-x-0 bottom-0 flex-row"
      style={[
        { height: grossHeight },
        styles.containerBorder,
        containerStyle,
        rContainerStyle,
      ]}
    >
      {TAB_ITEMS.map((item) => {
        const isFocused = currentRoute === item.route;
        return (
          <TabBarButton
            key={item.route}
            item={item}
            isFocused={isFocused}
            activeColor={activeColor}
            inactiveColor={inactiveColor}
            onPress={() => handleTabPress(navigation, state, item.route)}
          />
        );
      })}
    </Animated.View>
  );
}

type TabBarButtonProps = {
  readonly item: TabItem;
  readonly isFocused: boolean;
  readonly activeColor: string;
  readonly inactiveColor: string;
  readonly onPress: () => void;
};

const TabBarButton = React.memo(function TabBarButton({
  item,
  isFocused,
  activeColor,
  inactiveColor,
  onPress,
}: TabBarButtonProps) {
  const color = isFocused ? activeColor : inactiveColor;
  const label = translate(item.labelKey);
  const hint = translate(item.hintKey);
  const indicatorColorStyle = React.useMemo(
    () => ({ backgroundColor: activeColor }),
    [activeColor]
  );
  const indicatorOpacityStyle = isFocused
    ? styles.indicatorVisible
    : styles.indicatorHidden;

  return (
    <Pressable
      testID={item.testID}
      className="flex-1 items-center justify-center px-2"
      style={styles.tabButton}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: isFocused }}
      accessibilityHint={hint}
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <View pointerEvents="none" testID={item.iconTestID}>
        <item.Icon color={color} />
      </View>
      <View
        pointerEvents="none"
        style={[styles.indicator, indicatorColorStyle, indicatorOpacityStyle]}
      />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  containerBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  indicator: {
    marginTop: 6,
    height: 3,
    width: 18,
    borderRadius: 999,
  },
  indicatorHidden: {
    opacity: 0,
  },
  indicatorVisible: {
    opacity: 1,
  },
  tabButton: {
    minHeight: 48,
  },
});
