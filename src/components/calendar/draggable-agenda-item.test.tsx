import { render, screen } from '@testing-library/react-native';
import React from 'react';

import { DraggableAgendaItem } from '@/components/calendar/draggable-agenda-item';

const task = {
  id: 't1',
  title: 'Water plants',
  description: 'Morning routine',
  dueAtLocal: new Date().toISOString(),
  dueAtUtc: new Date().toISOString(),
  timezone: 'Europe/Berlin',
  status: 'pending',
} as any;

describe('DraggableAgendaItem accessibility', () => {
  it('renders with accessibility label and actions', () => {
    render(<DraggableAgendaItem task={task} />);
    const el = screen.getByLabelText(/Water plants/);
    expect(el).toBeTruthy();
  });
});
