import React from 'react';

import { cleanup, screen, setup } from '@/lib/test-utils';
import type { AdjustmentSuggestion } from '@/types/ai-adjustments';

import { AdjustmentSuggestionCard } from '../adjustment-suggestion-card';

afterEach(cleanup);

const mockSuggestion: AdjustmentSuggestion = {
  id: 'suggestion-1',
  plantId: 'plant-1',
  playbookId: 'playbook-1',
  suggestionType: 'schedule_shift',
  rootCause: 'skipped_tasks',
  reasoning: 'You have skipped 3 tasks in the past 7 days.',
  affectedTasks: [
    {
      taskId: 'task-1',
      currentDueDate: '2025-01-15',
      proposedDueDate: '2025-01-17',
      reason: 'Adjusting schedule',
    },
    {
      taskId: 'task-2',
      currentDueDate: '2025-01-16',
      proposedDueDate: '2025-01-18',
      reason: 'Adjusting schedule',
    },
  ],
  confidence: 0.85,
  status: 'pending',
  expiresAt: Date.now() + 1000 * 60 * 60 * 24,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

describe('AdjustmentSuggestionCard', () => {
  const onViewMock = jest.fn();
  const onDismissMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    test('renders correctly with suggestion data', async () => {
      setup(
        <AdjustmentSuggestionCard
          suggestion={mockSuggestion}
          onView={onViewMock}
          onDismiss={onDismissMock}
        />
      );

      expect(
        await screen.findByTestId('adjustment-suggestion-card')
      ).toBeOnTheScreen();
      expect(screen.getByText(/Schedule Adjustment/)).toBeOnTheScreen();
      expect(
        screen.getByText('You have skipped 3 tasks in the past 7 days.')
      ).toBeOnTheScreen();
    });

    test('displays correct task count', async () => {
      setup(
        <AdjustmentSuggestionCard
          suggestion={mockSuggestion}
          onView={onViewMock}
          onDismiss={onDismissMock}
        />
      );

      expect(screen.getByText('2 tasks affected')).toBeOnTheScreen();
    });

    test('displays correct confidence percentage', async () => {
      setup(
        <AdjustmentSuggestionCard
          suggestion={mockSuggestion}
          onView={onViewMock}
          onDismiss={onDismissMock}
        />
      );

      expect(screen.getByText('85% confidence')).toBeOnTheScreen();
    });

    test('displays disclaimer', async () => {
      setup(
        <AdjustmentSuggestionCard
          suggestion={mockSuggestion}
          onView={onViewMock}
          onDismiss={onDismissMock}
        />
      );

      expect(
        screen.getByText(/AI suggestion • Educational, not professional advice/)
      ).toBeOnTheScreen();
    });
  });

  describe('Interactions', () => {
    test('calls onView when view details button pressed', async () => {
      const { user } = setup(
        <AdjustmentSuggestionCard
          suggestion={mockSuggestion}
          onView={onViewMock}
          onDismiss={onDismissMock}
        />
      );

      const viewButton = screen.getByTestId('view-details-button');
      await user.press(viewButton);

      expect(onViewMock).toHaveBeenCalledWith(mockSuggestion);
      expect(onViewMock).toHaveBeenCalledTimes(1);
    });

    test('calls onDismiss when dismiss button pressed', async () => {
      const { user } = setup(
        <AdjustmentSuggestionCard
          suggestion={mockSuggestion}
          onView={onViewMock}
          onDismiss={onDismissMock}
        />
      );

      const dismissButton = screen.getByTestId('dismiss-button');
      await user.press(dismissButton);

      expect(onDismissMock).toHaveBeenCalledWith('suggestion-1');
      expect(onDismissMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge Cases', () => {
    test('handles single task correctly', async () => {
      const singleTaskSuggestion = {
        ...mockSuggestion,
        affectedTasks: [mockSuggestion.affectedTasks[0]],
      };

      setup(
        <AdjustmentSuggestionCard
          suggestion={singleTaskSuggestion}
          onView={onViewMock}
          onDismiss={onDismissMock}
        />
      );

      expect(screen.getByText('1 task affected')).toBeOnTheScreen();
    });

    test('handles low confidence correctly', async () => {
      const lowConfidenceSuggestion = {
        ...mockSuggestion,
        confidence: 0.55,
      };

      setup(
        <AdjustmentSuggestionCard
          suggestion={lowConfidenceSuggestion}
          onView={onViewMock}
          onDismiss={onDismissMock}
        />
      );

      expect(screen.getByText('55% confidence')).toBeOnTheScreen();
    });
  });
});
