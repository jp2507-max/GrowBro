import React from 'react';

import { useRegisterScrollHandlers } from '@/components/calendar/drag-drop-provider';
import { EmptyList, List } from '@/components/ui';
import type { AgendaItem } from '@/types/agenda';

type Props = {
  data: AgendaItem[];
  isLoading: boolean;
  renderItem: ({ item }: { item: AgendaItem }) => React.ReactElement | null;
  keyExtractor?: (item: AgendaItem, index: number) => string;
};

export function AgendaList({
  data,
  isLoading,
  renderItem,
  keyExtractor,
}: Props): React.ReactElement {
  const getItemType = React.useCallback((item: AgendaItem) => item.type, []);

  const _keyExtractor = React.useCallback(
    (item: AgendaItem, index: number) => keyExtractor?.(item, index) ?? item.id,
    [keyExtractor]
  );

  const { listRef, onScroll, onLayout } = useRegisterScrollHandlers();

  return (
    <List<AgendaItem>
      ref={listRef as any}
      data={data}
      renderItem={renderItem}
      keyExtractor={_keyExtractor}
      getItemType={getItemType}
      removeClippedSubviews
      onScroll={onScroll}
      onLayout={onLayout}
      ListEmptyComponent={<EmptyList isLoading={isLoading} />}
      showsVerticalScrollIndicator={false}
    />
  );
}
