import { render, screen } from '@testing-library/react-native';
import React from 'react';

import { Text } from '@/components/ui';
import type { AgendaItem } from '@/types/agenda';

import { AgendaList } from './agenda-list';

function makeItem(id: string, type: AgendaItem['type']): AgendaItem {
  return {
    id,
    type,
    date: new Date('2025-01-01T00:00:00Z'),
    height: 48,
  };
}

describe('AgendaList', () => {
  it('renders items and uses item.id as key by default', () => {
    const data: AgendaItem[] = [
      makeItem('h-1', 'date-header'),
      makeItem('t-1', 'task'),
    ];

    render(
      <AgendaList
        data={data}
        isLoading={false}
        renderItem={({ item }) => <Text>{item.id}</Text>}
      />
    );

    expect(screen.getByText('h-1')).toBeTruthy();
    expect(screen.getByText('t-1')).toBeTruthy();
  });

  it('shows empty state when no data and not loading', () => {
    render(<AgendaList data={[]} isLoading={false} renderItem={() => null} />);
    expect(screen.getByText('Sorry! No data found')).toBeTruthy();
  });
});
