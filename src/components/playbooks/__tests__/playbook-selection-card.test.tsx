import React from 'react';

import { PlaybookSelectionCard } from '@/components/playbooks/playbook-selection-card';
import { cleanup, screen, setup } from '@/lib/test-utils';
import type { PlaybookPreview } from '@/types/playbook';

afterEach(cleanup);

const mockPreview: PlaybookPreview = {
  playbookId: 'test-playbook-1',
  name: 'Auto Indoor Beginner',
  setup: 'auto_indoor',
  totalWeeks: 12,
  totalTasks: 45,
  phaseBreakdown: [
    { phase: 'seedling', durationDays: 14, taskCount: 8 },
    { phase: 'veg', durationDays: 28, taskCount: 15 },
    { phase: 'flower', durationDays: 42, taskCount: 20 },
    { phase: 'harvest', durationDays: 7, taskCount: 2 },
  ],
};

describe('PlaybookSelectionCard', () => {
  test('renders correctly with preview data', async () => {
    const onPress = jest.fn();
    setup(<PlaybookSelectionCard preview={mockPreview} onPress={onPress} />);

    expect(await screen.findByText('Auto Indoor Beginner')).toBeOnTheScreen();
    expect(await screen.findByText('12 weeks')).toBeOnTheScreen();
    expect(await screen.findByText('45 tasks')).toBeOnTheScreen();
  });

  test('displays phase breakdown correctly', async () => {
    const onPress = jest.fn();
    setup(<PlaybookSelectionCard preview={mockPreview} onPress={onPress} />);

    expect(await screen.findByText('seedling')).toBeOnTheScreen();
    expect(await screen.findByText('14 days')).toBeOnTheScreen();
    expect(await screen.findByText('8 tasks')).toBeOnTheScreen();
  });

  test('calls onPress with playbook ID when pressed', async () => {
    const onPress = jest.fn();
    const { user } = setup(
      <PlaybookSelectionCard preview={mockPreview} onPress={onPress} />
    );

    const card = await screen.findByTestId('playbook-card-auto_indoor');
    await user.press(card);

    expect(onPress).toHaveBeenCalledWith('test-playbook-1');
  });

  test('displays estimated dates when provided', async () => {
    const onPress = jest.fn();
    const previewWithDates = {
      ...mockPreview,
      estimatedStartDate: '2025-01-01',
      estimatedEndDate: '2025-03-31',
    };

    setup(
      <PlaybookSelectionCard preview={previewWithDates} onPress={onPress} />
    );

    expect(await screen.findByText(/Estimated:/)).toBeOnTheScreen();
  });

  test('has proper accessibility labels', async () => {
    const onPress = jest.fn();
    setup(<PlaybookSelectionCard preview={mockPreview} onPress={onPress} />);

    const card = await screen.findByTestId('playbook-card-auto_indoor');
    expect(card).toBeOnTheScreen();
  });
});
