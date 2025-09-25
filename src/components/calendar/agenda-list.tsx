import type { ListRenderItem } from '@shopify/flash-list';
import React from 'react';

import { useRegisterScrollHandlers } from '@/components/calendar/drag-drop-provider';
import { EmptyList, List } from '@/components/ui';
import type { AgendaItem } from '@/types/agenda';

type Props = {
  data: AgendaItem[];
  isLoading: boolean;
  renderItem: ListRenderItem<AgendaItem>;
  keyExtractor?: (item: AgendaItem, index: number) => string;
};

export function AgendaList({
  data,
  isLoading,
  renderItem,
  keyExtractor,
}: Props): React.ReactElement {
  const getItemType = React.useCallback(
    (item: AgendaItem, _index: number) => item.type,
    []
  );

  const _keyExtractor = React.useCallback(
    (item: AgendaItem, index: number) => keyExtractor?.(item, index) ?? item.id,
    [keyExtractor]
  );

  const { listRef, onScroll, onLayout } = useRegisterScrollHandlers();

  return (
    <List
      ref={listRef as any}
      data={data}
      renderItem={renderItem as ListRenderItem<unknown>}
      keyExtractor={_keyExtractor as (item: unknown, index: number) => string}
      getItemType={
        getItemType as (item: unknown, index: number) => string | number
      }
      removeClippedSubviews
      onScroll={onScroll}
      onLayout={onLayout}
      ListEmptyComponent={<EmptyList isLoading={isLoading} />}
      showsVerticalScrollIndicator={false}
    />
  );
}
