import {
  FlashList,
  type FlashListProps,
  type FlashListRef,
  type ListRenderItemInfo,
} from '@shopify/flash-list';
import React, { forwardRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import {
  getMediumFlashListConfig,
  getOptimizedFlashListConfig,
} from '@/lib/flashlist-config';
import { useThemeConfig } from '@/lib/use-theme-config';

const SKELETON_PLACEHOLDERS = 6;

type ListStrings = {
  readonly emptyTitle: string;
  readonly emptyBody: string;
  readonly errorTitle: string;
  readonly errorBody: string;
  readonly retryLabel: string;
};

type ListProps<ItemT> = Omit<FlashListProps<ItemT>, 'estimatedItemSize'> & {
  readonly isLoading?: boolean;
  readonly isSkeletonTimedOut?: boolean;
  readonly error?: Error | null;
  readonly onRetry?: () => void;
  readonly ListSkeletonComponent?: React.ComponentType<{ index: number }>;
  readonly strings?: Partial<ListStrings>;
};

type ListRestProps<ItemT> = Omit<
  ListProps<ItemT>,
  | 'data'
  | 'renderItem'
  | 'ListEmptyComponent'
  | 'ListFooterComponent'
  | 'ListSkeletonComponent'
  | 'keyExtractor'
  | 'onRetry'
  | 'error'
  | 'isLoading'
  | 'isSkeletonTimedOut'
  | 'strings'
  | 'drawDistance'
  | 'removeClippedSubviews'
  | 'scrollEventThrottle'
  | 'contentContainerStyle'
  | 'style'
>;

type ListDerivedState<ItemT> = {
  readonly resolvedStrings: ListStrings;
  readonly showSkeleton: boolean;
  readonly showError: boolean;
  readonly isEmpty: boolean;
  readonly isJest: boolean;
  readonly itemCount: number;
  readonly listData: readonly ItemT[];
  readonly renderItemResolved: (
    info: ListRenderItemInfo<ItemT>
  ) => React.ReactElement | null;
  readonly keyExtractorResolved: (item: ItemT, index: number) => string;
  readonly ListEmptyComponentResolved: () => React.ReactElement;
};

type ListLayoutConfig = {
  readonly mergedContentContainerStyle: ViewStyle;
  readonly mergedListStyle: ViewStyle;
  readonly resolvedDrawDistance: number;
  readonly resolvedRemoveClippedSubviews: boolean;
  readonly resolvedScrollEventThrottle: number;
};

type ListStateBaseProps = {
  readonly title: string;
  readonly body?: string;
  readonly className?: string;
};

type ListErrorStateProps = ListStateBaseProps & {
  readonly onRetry?: () => void;
  readonly retryLabel?: string;
};

const DEFAULT_STRINGS: ListStrings = {
  emptyTitle: 'list.empty.title',
  emptyBody: 'list.empty.body',
  errorTitle: 'list.error.title',
  errorBody: 'list.error.body',
  retryLabel: 'list.retry',
};

const styles = StyleSheet.create({
  contentContainer: {
    flexGrow: 0,
  },
  list: {
    flex: 1,
  },
});

const baseListStyle = StyleSheet.flatten(styles.list) as ViewStyle;
const baseContentStyle = StyleSheet.flatten(
  styles.contentContainer
) as ViewStyle;
const EMPTY_LIST: readonly unknown[] = [];
const SKELETON_DATA: readonly number[] = Array.from(
  { length: SKELETON_PLACEHOLDERS },
  (_, index) => index
);

function mergeListStyle(
  styleProp: StyleProp<ViewStyle>,
  backgroundColor: string
): ViewStyle {
  const flattened = StyleSheet.flatten(styleProp) as ViewStyle | undefined;
  return {
    ...baseListStyle,
    backgroundColor,
    ...(flattened ?? {}),
  };
}

function mergeContentStyle(styleProp: StyleProp<ViewStyle>): ViewStyle {
  const flattened = StyleSheet.flatten(styleProp) as ViewStyle | undefined;
  return {
    ...baseContentStyle,
    ...(flattened ?? {}),
  };
}

function buildListData<ItemT>(
  showSkeleton: boolean,
  data: readonly ItemT[] | null | undefined
): readonly ItemT[] {
  if (showSkeleton) {
    return SKELETON_DATA as unknown as readonly ItemT[];
  }
  return data ?? (EMPTY_LIST as readonly ItemT[]);
}

function resolveStrings(
  translate: (key: string) => string,
  overrides?: Partial<ListStrings>
): ListStrings {
  return {
    emptyTitle: overrides?.emptyTitle ?? translate(DEFAULT_STRINGS.emptyTitle),
    emptyBody: overrides?.emptyBody ?? translate(DEFAULT_STRINGS.emptyBody),
    errorTitle: overrides?.errorTitle ?? translate(DEFAULT_STRINGS.errorTitle),
    errorBody: overrides?.errorBody ?? translate(DEFAULT_STRINGS.errorBody),
    retryLabel: overrides?.retryLabel ?? translate(DEFAULT_STRINGS.retryLabel),
  };
}

function fallbackKeyExtractor<ItemT>(item: ItemT, index: number): string {
  if (
    item &&
    typeof item === 'object' &&
    'id' in (item as Record<string, unknown>)
  ) {
    const idValue = (item as { id?: string | number }).id;
    if (idValue != null) return String(idValue);
  }
  return String(index);
}

function renderFooter(
  footer?: React.ComponentType | React.ReactElement | null
): React.ReactNode {
  if (!footer) return null;
  if (React.isValidElement(footer)) return footer;
  return React.createElement(footer);
}

type EmptyContentProps = {
  readonly hasError: boolean;
  readonly strings: ListStrings;
  readonly onRetry?: () => void;
  readonly ListEmptyComponent?: React.ComponentType | React.ReactElement | null;
};

function renderEmptyContent({
  hasError,
  strings,
  onRetry,
  ListEmptyComponent,
}: EmptyContentProps): React.ReactElement {
  if (hasError) {
    return (
      <ListErrorState
        title={strings.errorTitle}
        body={strings.errorBody}
        retryLabel={strings.retryLabel}
        onRetry={onRetry}
      />
    );
  }

  if (ListEmptyComponent) {
    if (React.isValidElement(ListEmptyComponent)) return ListEmptyComponent;
    const Component = ListEmptyComponent as React.ComponentType;
    return <Component />;
  }

  return <ListEmptyState title={strings.emptyTitle} body={strings.emptyBody} />;
}

function useListDerivedState<ItemT>({
  data,
  renderItem,
  ListEmptyComponent,
  ListSkeletonComponent,
  keyExtractor,
  onRetry,
  error,
  isLoading,
  isSkeletonTimedOut,
  strings,
}: ListProps<ItemT>): ListDerivedState<ItemT> {
  const { t } = useTranslation();
  const resolvedStrings = useMemo(
    () => resolveStrings(t, strings),
    [strings, t]
  );
  const showSkeleton = Boolean(isLoading && !isSkeletonTimedOut);
  const showError = Boolean(error);
  const isEmpty = !data || data.length === 0;
  const isJest = Boolean(process?.env?.JEST_WORKER_ID);
  const itemCount = showSkeleton ? SKELETON_PLACEHOLDERS : (data?.length ?? 0);
  const Skeleton = useMemo(
    () => ListSkeletonComponent ?? DefaultListSkeleton,
    [ListSkeletonComponent]
  );
  const listData = useMemo(
    () => buildListData(showSkeleton, data),
    [data, showSkeleton]
  );
  const keyExtractorResolved = useCallback(
    (item: ItemT, index: number) =>
      showSkeleton
        ? `skeleton-${index}`
        : (keyExtractor ?? fallbackKeyExtractor)(item, index),
    [keyExtractor, showSkeleton]
  );
  const renderItemResolved = useCallback(
    (info: ListRenderItemInfo<ItemT>) => {
      if (showSkeleton) return <Skeleton index={info.index} />;
      return renderItem?.(info) ?? null;
    },
    [renderItem, showSkeleton, Skeleton]
  );
  const ListEmptyComponentResolved = useCallback(
    () =>
      renderEmptyContent({
        hasError: showSkeleton ? false : showError,
        strings: resolvedStrings,
        onRetry,
        ListEmptyComponent,
      }),
    [showSkeleton, showError, resolvedStrings, onRetry, ListEmptyComponent]
  );

  return {
    resolvedStrings,
    showSkeleton,
    showError,
    isEmpty,
    isJest,
    itemCount,
    listData,
    renderItemResolved,
    keyExtractorResolved,
    ListEmptyComponentResolved,
  };
}

function useListLayoutConfig({
  itemCount,
  drawDistance,
  removeClippedSubviews,
  scrollEventThrottle,
  contentContainerStyle,
  style,
}: {
  itemCount: number;
  drawDistance?: number;
  removeClippedSubviews?: boolean;
  scrollEventThrottle?: number;
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
}): ListLayoutConfig {
  const theme = useThemeConfig();
  const flashListConfig = useMemo(
    () =>
      itemCount >= 100
        ? getOptimizedFlashListConfig()
        : getMediumFlashListConfig(),
    [itemCount]
  );
  const resolvedDrawDistance = drawDistance ?? flashListConfig.drawDistance;
  const resolvedRemoveClippedSubviews =
    removeClippedSubviews ?? flashListConfig.removeClippedSubviews;
  const resolvedScrollEventThrottle =
    scrollEventThrottle ?? flashListConfig.scrollEventThrottle;
  const mergedContentContainerStyle = useMemo(
    () => mergeContentStyle(contentContainerStyle as StyleProp<ViewStyle>),
    [contentContainerStyle]
  );
  const mergedListStyle = useMemo(
    () =>
      mergeListStyle(style as StyleProp<ViewStyle>, theme.colors.background),
    [style, theme.colors.background]
  );

  return {
    mergedContentContainerStyle,
    mergedListStyle,
    resolvedDrawDistance,
    resolvedRemoveClippedSubviews,
    resolvedScrollEventThrottle,
  };
}

function buildSharedProps<ItemT>(params: {
  data: ListProps<ItemT>['data'];
  renderItem: ListProps<ItemT>['renderItem'];
  ListEmptyComponent: ListProps<ItemT>['ListEmptyComponent'];
  ListFooterComponent: ListProps<ItemT>['ListFooterComponent'];
  ListSkeletonComponent: ListProps<ItemT>['ListSkeletonComponent'];
  keyExtractor: ListProps<ItemT>['keyExtractor'];
  onRetry: ListProps<ItemT>['onRetry'];
  error: ListProps<ItemT>['error'];
  isLoading: ListProps<ItemT>['isLoading'];
  isSkeletonTimedOut: ListProps<ItemT>['isSkeletonTimedOut'];
  strings: ListStrings;
  showSkeleton: boolean;
  showError: boolean;
  drawDistance: number;
  removeClippedSubviews: boolean;
  scrollEventThrottle: number;
  contentContainerStyle: ViewStyle;
  style: ViewStyle;
  restProps: ListRestProps<ItemT>;
}): ListProps<ItemT> & {
  readonly strings: ListStrings;
  readonly showSkeleton: boolean;
  readonly showError: boolean;
} {
  return {
    data: params.data,
    renderItem: params.renderItem,
    ListEmptyComponent: params.ListEmptyComponent,
    ListFooterComponent: params.ListFooterComponent,
    ListSkeletonComponent: params.ListSkeletonComponent,
    keyExtractor: params.keyExtractor,
    onRetry: params.onRetry,
    error: params.error,
    isLoading: params.isLoading,
    isSkeletonTimedOut: params.isSkeletonTimedOut,
    strings: params.strings,
    showSkeleton: params.showSkeleton,
    showError: params.showError,
    drawDistance: params.drawDistance,
    removeClippedSubviews: params.removeClippedSubviews,
    scrollEventThrottle: params.scrollEventThrottle,
    contentContainerStyle: params.contentContainerStyle,
    style: params.style,
    ...params.restProps,
  };
}

function renderJestList<ItemT>(
  props: ListProps<ItemT> & {
    readonly strings: ListStrings;
    readonly showSkeleton: boolean;
    readonly showError: boolean;
    readonly isEmpty: boolean;
  }
): React.ReactElement {
  const {
    data,
    renderItem,
    ListFooterComponent,
    ListSkeletonComponent,
    keyExtractor = fallbackKeyExtractor,
    strings,
    showSkeleton,
    showError,
    isEmpty,
    onRetry,
    ListEmptyComponent,
  } = props;

  if (showSkeleton) {
    const Skeleton = ListSkeletonComponent ?? DefaultListSkeleton;
    return (
      <View className="flex-1" testID="list-skeleton">
        {Array.from({ length: SKELETON_PLACEHOLDERS }, (_, index) => (
          <Skeleton key={`skeleton-${index}`} index={index} />
        ))}
      </View>
    );
  }

  if (showError || isEmpty) {
    return renderEmptyContent({
      hasError: showError,
      strings,
      onRetry,
      ListEmptyComponent,
    });
  }

  const footer = renderFooter(ListFooterComponent);
  const items = (data ?? []) as readonly ItemT[];

  return (
    <View className="flex-1" testID="list-content">
      {items.map((item, index) => (
        <View key={keyExtractor(item, index)}>
          {renderItem?.({ item, index } as ListRenderItemInfo<ItemT>)}
        </View>
      ))}
      {footer}
    </View>
  );
}

function renderNativeList<ItemT>(
  props: ListProps<ItemT> & {
    readonly strings: ListStrings;
    readonly showSkeleton: boolean;
    readonly showError: boolean;
    readonly ref: React.ForwardedRef<FlashListRef<ItemT>>;
    readonly listData: readonly ItemT[];
    readonly renderItemResolved: (
      info: ListRenderItemInfo<ItemT>
    ) => React.ReactElement | null;
    readonly keyExtractorResolved: (item: ItemT, index: number) => string;
    readonly ListEmptyComponentResolved: () => React.ReactElement;
    readonly mergedContentContainerStyle: ViewStyle;
    readonly mergedListStyle: ViewStyle;
  }
): React.ReactElement {
  const {
    data: _data,
    renderItem: _renderItem,
    keyExtractor: _keyExtractor,
    ListEmptyComponent: _ListEmptyComponent,
    ListFooterComponent,
    ref,
    onEndReachedThreshold,
    listData,
    renderItemResolved,
    keyExtractorResolved,
    ListEmptyComponentResolved,
    mergedContentContainerStyle,
    mergedListStyle,
    ...rest
  } = props;

  return (
    <FlashList<ItemT>
      ref={ref}
      data={listData}
      renderItem={renderItemResolved}
      keyExtractor={keyExtractorResolved}
      ListEmptyComponent={ListEmptyComponentResolved}
      ListFooterComponent={ListFooterComponent}
      onEndReachedThreshold={onEndReachedThreshold ?? 0.4}
      contentContainerStyle={mergedContentContainerStyle}
      style={mergedListStyle}
      {...rest}
    />
  );
}

export const List = forwardRef(ListInner) as <ItemT>(
  props: ListProps<ItemT> & React.RefAttributes<FlashListRef<ItemT>>
) => React.ReactElement;

function ListInner<ItemT>(
  {
    data,
    renderItem,
    ListEmptyComponent,
    ListFooterComponent,
    ListSkeletonComponent,
    keyExtractor,
    onRetry,
    error,
    isLoading,
    isSkeletonTimedOut,
    strings,
    drawDistance,
    removeClippedSubviews,
    scrollEventThrottle,
    contentContainerStyle,
    style,
    ...rest
  }: ListProps<ItemT>,
  ref: React.ForwardedRef<FlashListRef<ItemT>>
): React.ReactElement {
  const derivedState = useListDerivedState({
    data,
    renderItem,
    ListEmptyComponent,
    ListSkeletonComponent,
    keyExtractor,
    onRetry,
    error,
    isLoading,
    isSkeletonTimedOut,
    strings,
  });
  const layoutConfig = useListLayoutConfig({
    itemCount: derivedState.itemCount,
    drawDistance,
    removeClippedSubviews,
    scrollEventThrottle,
    contentContainerStyle,
    style,
  });
  const sharedProps = buildSharedProps({
    data,
    renderItem,
    ListEmptyComponent,
    ListFooterComponent,
    ListSkeletonComponent,
    keyExtractor,
    onRetry,
    error,
    isLoading,
    isSkeletonTimedOut,
    strings: derivedState.resolvedStrings,
    showSkeleton: derivedState.showSkeleton,
    showError: derivedState.showError,
    drawDistance: layoutConfig.resolvedDrawDistance,
    removeClippedSubviews: layoutConfig.resolvedRemoveClippedSubviews,
    scrollEventThrottle: layoutConfig.resolvedScrollEventThrottle,
    contentContainerStyle: layoutConfig.mergedContentContainerStyle,
    style: layoutConfig.mergedListStyle,
    restProps: rest,
  });

  if (derivedState.isJest) {
    return renderJestList({ ...sharedProps, isEmpty: derivedState.isEmpty });
  }

  return renderNativeList({
    ...sharedProps,
    ref,
    listData: derivedState.listData,
    renderItemResolved: derivedState.renderItemResolved,
    keyExtractorResolved: derivedState.keyExtractorResolved,
    ListEmptyComponentResolved: derivedState.ListEmptyComponentResolved,
    mergedContentContainerStyle: layoutConfig.mergedContentContainerStyle,
    mergedListStyle: layoutConfig.mergedListStyle,
  });
}

export const EmptyList = React.memo(function EmptyList({
  isLoading = false,
}: {
  isLoading?: boolean;
}) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <View
        className="flex-1 items-center justify-center gap-2 py-12"
        testID="list-empty-loading"
      >
        <ActivityIndicator />
        <Text className="text-sm text-neutral-600 dark:text-neutral-300">
          {t(DEFAULT_STRINGS.emptyBody)}
        </Text>
      </View>
    );
  }

  return (
    <ListEmptyState
      className="py-12"
      title={t(DEFAULT_STRINGS.emptyTitle)}
      body={t(DEFAULT_STRINGS.emptyBody)}
    />
  );
});

export const ListEmptyState = React.memo(function ListEmptyState({
  className,
  title,
  body,
}: ListStateBaseProps) {
  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="text"
      className={`flex-1 items-center justify-center px-6 py-12 ${className ?? ''}`.trim()}
      testID="list-empty"
    >
      <Text className="text-center text-lg font-semibold text-neutral-900 dark:text-neutral-100">
        {title}
      </Text>
      {body ? (
        <Text className="mt-2 text-center text-base text-neutral-400 dark:text-neutral-300">
          {body}
        </Text>
      ) : null}
    </View>
  );
});

export const ListErrorState = React.memo(function ListErrorState({
  className,
  title,
  body,
  onRetry,
  retryLabel,
}: ListErrorStateProps) {
  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      className={`flex-1 items-center justify-center px-6 py-12 ${className ?? ''}`.trim()}
      testID="list-error"
    >
      <Text className="text-center text-lg font-semibold text-neutral-900 dark:text-neutral-100">
        {title}
      </Text>
      {body ? (
        <Text className="mt-2 text-center text-base text-neutral-400 dark:text-neutral-300">
          {body}
        </Text>
      ) : null}
      {onRetry ? (
        <Button
          className="mt-6"
          accessibilityRole="button"
          onPress={onRetry}
          testID="list-retry"
          label={retryLabel}
        />
      ) : null}
    </View>
  );
});

const DefaultListSkeleton = React.memo(function DefaultListSkeleton() {
  return (
    <View className="flex-row items-center gap-4 px-6 py-4">
      <View className="size-12 rounded-full bg-neutral-800/30 dark:bg-neutral-200/20" />
      <View className="flex-1 gap-2">
        <View className="h-4 w-3/5 rounded-full bg-neutral-800/30 dark:bg-neutral-200/20" />
        <View className="h-4 w-2/5 rounded-full bg-neutral-800/20 dark:bg-neutral-200/10" />
      </View>
    </View>
  );
});
