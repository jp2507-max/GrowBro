import { render, screen } from '@testing-library/react-native';
import React from 'react';

import type { Task } from '@/types/calendar';

import { AgendaItemRow } from './agenda-item';
jest.mock('@/lib/i18n', () => ({
  translate: (k: string) => {
    switch (k) {
      case 'calendar.out_of_range':
      case 'calendar.out_of_range_label':
        return 'Out of range';
      case 'calendar.needs_review_label':
      case 'calendar.review':
        return 'Needs review';
      default:
        return k;
    }
  },
}));

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: 'Feed Plants',
    description: 'Add nutrients',
    dueAtLocal: '2025-01-01T09:00:00.000Z',
    dueAtUtc: '2025-01-01T09:00:00.000Z',
    timezone: 'UTC',
    status: 'pending',
    metadata: {},
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  } as Task;
}

describe('AgendaItemRow', () => {
  test('renders event icon for feeding', async () => {
    const task = makeTask({ metadata: { eventType: 'feeding' } });
    render(<AgendaItemRow task={task} />);
    expect(screen.getByTestId('event-icon-feeding')).toBeOnTheScreen();
    expect(screen.getByText('Feed Plants')).toBeOnTheScreen();
  });

  test('renders out-of-range badge when metadata.outOfRange is true', async () => {
    const task = makeTask({
      title: 'Check EC',
      metadata: { outOfRange: true },
    });
    render(<AgendaItemRow task={task} />);
    expect(
      screen.getByText(/out of range|außerhalb des Bereichs/i)
    ).toBeOnTheScreen();
  });

  test('does not render icon when no eventType provided', async () => {
    const task = makeTask();
    render(<AgendaItemRow task={task} />);
    expect(screen.queryByTestId(/event-icon-/)).toBeNull();
  });
});
