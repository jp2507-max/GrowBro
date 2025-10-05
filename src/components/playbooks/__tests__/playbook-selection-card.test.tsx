import React from 'react';

import { PlaybookSelectionCard } from '@/components/playbooks/playbook-selection-card';
import { cleanup, screen, setup } from '@/lib/test-utils';
import type { PlaybookPreview } from '@/types/playbook';

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: any) => {
      // For testing, return a simple version of the translation
      if (key.includes('durationDays')) {
        return `${options?.count || 0} days`;
      }
      if (key.includes('taskCount')) {
        return `${options?.count || 0} tasks`;
      }
      if (key.includes('totalWeeks')) {
        return `${options?.count || 0} weeks`;
      }
      if (key.includes('phaseBreakdownTitle')) {
        return 'Phase Breakdown';
      }
      if (key.includes('estimatedRange')) {
        return `Estimated: ${options?.start} → ${options?.end}`;
      }
      if (key.includes('phases.')) {
        return key.replace('phases.', ''); // Return just the phase name
      }
      if (key.includes('selection.autoIndoor')) {
        return 'Auto Indoor';
      }
      if (key.includes('selection.autoOutdoor')) {
        return 'Auto Outdoor';
      }
      if (key.includes('selection.photoIndoor')) {
        return 'Photo Indoor';
      }
      if (key.includes('selection.photoOutdoor')) {
        return 'Photo Outdoor';
      }
      return key; // Fallback to return the key itself
    },
  }),
}));

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
