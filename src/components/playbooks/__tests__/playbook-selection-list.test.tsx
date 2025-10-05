import React from 'react';

import { cleanup, screen, setup } from '@/lib/test-utils';

import { PlaybookSelectionList } from '../playbook-selection-list';

afterEach(cleanup);

const mockOnSelectPlaybook = jest.fn();
const mockOnRetry = jest.fn();

const mockPlaybooks = [
  {
    playbookId: '1',
    name: 'Test Playbook 1',
    setup: 'auto_indoor' as const,
    totalWeeks: 8,
    totalTasks: 15,
    phaseBreakdown: [
      {
        phase: 'seedling' as const,
        durationDays: 7,
        taskCount: 3,
      },
      {
        phase: 'veg' as const,
        durationDays: 14,
        taskCount: 5,
      },
      {
        phase: 'flower' as const,
        durationDays: 21,
        taskCount: 7,
      },
    ],
    estimatedStartDate: '2024-01-01T00:00:00Z',
    estimatedEndDate: '2024-01-08T00:00:00Z',
  },
];

describe('PlaybookSelectionList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Loading State', () => {
    test('renders loading skeletons when isLoading is true', async () => {
      setup(
        <PlaybookSelectionList
          playbooks={[]}
          onSelectPlaybook={mockOnSelectPlaybook}
          isLoading={true}
        />
      );

      // Should render loading skeletons (3 of them based on the component)
      const skeletons = await screen.findAllByTestId('loading-skeleton');
      expect(skeletons).toHaveLength(3);
    });
  });

  describe('Error State', () => {
    test('renders error message and retry button when error is provided', async () => {
      const error = new Error('Network error');

      setup(
        <PlaybookSelectionList
          playbooks={[]}
          onSelectPlaybook={mockOnSelectPlaybook}
          error={error}
          onRetry={mockOnRetry}
        />
      );

      expect(
        await screen.findByText('Failed to Load Playbooks')
      ).toBeOnTheScreen();
      expect(screen.getByText('Network error')).toBeOnTheScreen();
      expect(screen.getByTestId('playbook-selection-retry')).toBeOnTheScreen();
    });

    test('retry button calls onRetry when pressed', async () => {
      const { user } = setup(
        <PlaybookSelectionList
          playbooks={[]}
          onSelectPlaybook={mockOnSelectPlaybook}
          error={new Error('Test error')}
          onRetry={mockOnRetry}
        />
      );

      const retryButton = await screen.findByTestId('playbook-selection-retry');
      await user.press(retryButton);

      expect(mockOnRetry).toHaveBeenCalledTimes(1);
    });

    test('does not render retry button when onRetry is not provided', async () => {
      setup(
        <PlaybookSelectionList
          playbooks={[]}
          onSelectPlaybook={mockOnSelectPlaybook}
          error={new Error('Test error')}
        />
      );

      expect(
        await screen.findByText('Failed to Load Playbooks')
      ).toBeOnTheScreen();
      expect(
        screen.queryByTestId('playbook-selection-retry')
      ).not.toBeOnTheScreen();
    });
  });

  describe('Empty State', () => {
    test('renders empty state when playbooks array is empty', async () => {
      setup(
        <PlaybookSelectionList
          playbooks={[]}
          onSelectPlaybook={mockOnSelectPlaybook}
        />
      );

      expect(
        await screen.findByText('No Playbooks Available')
      ).toBeOnTheScreen();
    });
  });

  describe('Playbook List', () => {
    test('renders playbook list container when playbooks are provided', async () => {
      setup(
        <PlaybookSelectionList
          playbooks={mockPlaybooks}
          onSelectPlaybook={mockOnSelectPlaybook}
        />
      );

      expect(
        await screen.findByTestId('playbook-selection-list')
      ).toBeOnTheScreen();
    });
  });
});
