/**
 * Unit tests for feeding adjustment modal
 *
 * Requirements: 5.5, 5.6
 */

import type {
  AdjustmentProposal,
  ProposedAdjustment,
} from '@/lib/nutrient-engine/services/schedule-adjustment-service';
import { AdjustmentAction } from '@/lib/nutrient-engine/services/schedule-adjustment-service';
import type { DeviationAlert } from '@/lib/nutrient-engine/types';
import { cleanup, screen, setup } from '@/lib/test-utils';

import { FeedingAdjustmentModal } from './feeding-adjustment-modal';

afterEach(cleanup);

describe('FeedingAdjustmentModal', () => {
  const mockAlert: DeviationAlert = {
    id: 'alert-1',
    readingId: 'reading-1',
    type: 'ec_high',
    severity: 'warning',
    message: 'EC is above target range (2.4 mS/cm)',
    recommendations: [
      'Dilute nutrient solution by 10%',
      'Recheck pH/EC in 24 hours',
    ],
    recommendationCodes: ['DILUTE_10PCT', 'RECHECK_24H'],
    triggeredAt: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const mockAdjustments: ProposedAdjustment[] = [
    {
      taskId: 'task-1',
      taskTitle: 'Feed - veg phase',
      currentDueDate: '2025-01-15T09:00:00-05:00',
      action: AdjustmentAction.DILUTE,
      reason: 'EC is too high, dilute next feeding by 10%',
      newInstructions: 'Updated feeding instructions...',
      severity: 'medium',
    },
    {
      taskId: 'task-2',
      taskTitle: 'Feed - flower phase',
      currentDueDate: '2025-01-16T09:00:00-05:00',
      action: AdjustmentAction.HOLD_FEED,
      reason: 'Skip next feeding to allow EC to drop',
      newInstructions: 'Hold feeding until EC stabilizes...',
      severity: 'high',
    },
  ];

  const mockProposal: AdjustmentProposal = {
    alert: mockAlert,
    proposedAdjustments: mockAdjustments,
    affectedTaskCount: 2,
    canApply: true,
  };

  const defaultProps = {
    proposal: mockProposal,
    onConfirm: jest.fn().mockResolvedValue(undefined),
    onCancel: jest.fn(),
    timezone: 'America/New_York',
  };

  describe('Rendering', () => {
    test('renders modal header with alert message', () => {
      setup(<FeedingAdjustmentModal {...defaultProps} />);

      expect(screen.getByText('Adjustment Required')).toBeOnTheScreen();
      expect(
        screen.getByText('EC is above target range (2.4 mS/cm)')
      ).toBeOnTheScreen();
      expect(screen.getByText('2 tasks affected')).toBeOnTheScreen();
    });

    test('renders recommendations section', () => {
      setup(<FeedingAdjustmentModal {...defaultProps} />);

      expect(screen.getByText('Recommended Actions')).toBeOnTheScreen();
      expect(
        screen.getByText('Dilute nutrient solution by 10%')
      ).toBeOnTheScreen();
      expect(screen.getByText('Recheck pH/EC in 24 hours')).toBeOnTheScreen();
    });

    test('renders all proposed adjustments', () => {
      setup(<FeedingAdjustmentModal {...defaultProps} />);

      expect(screen.getByText('Feed - veg phase')).toBeOnTheScreen();
      expect(screen.getByText('Feed - flower phase')).toBeOnTheScreen();
      expect(
        screen.getByText('EC is too high, dilute next feeding by 10%')
      ).toBeOnTheScreen();
      expect(
        screen.getByText('Skip next feeding to allow EC to drop')
      ).toBeOnTheScreen();
    });

    test('renders action buttons', () => {
      setup(<FeedingAdjustmentModal {...defaultProps} />);

      expect(
        screen.getByTestId('confirm-adjustments-button')
      ).toBeOnTheScreen();
      expect(screen.getByTestId('cancel-adjustments-button')).toBeOnTheScreen();
    });

    test('renders undo notice', () => {
      setup(<FeedingAdjustmentModal {...defaultProps} />);

      expect(
        screen.getByText(/You can undo these changes if needed/i)
      ).toBeOnTheScreen();
    });

    test('shows all tasks selected by default', () => {
      setup(<FeedingAdjustmentModal {...defaultProps} />);

      expect(screen.getByText('2 of 2 selected')).toBeOnTheScreen();
    });
  });

  describe('Task Selection', () => {
    test('toggles task selection on press', async () => {
      const { user } = setup(<FeedingAdjustmentModal {...defaultProps} />);

      // Initial state: all selected
      expect(screen.getByText('2 of 2 selected')).toBeOnTheScreen();

      // Tap first task to deselect
      const firstTask = screen.getByTestId('task-adjustment-task-1');
      await user.press(firstTask);

      // Should now show 1 of 2 selected
      expect(screen.getByText('1 of 2 selected')).toBeOnTheScreen();

      // Tap first task again to reselect
      await user.press(firstTask);

      // Should be back to 2 of 2 selected
      expect(screen.getByText('2 of 2 selected')).toBeOnTheScreen();
    });

    test('updates button label based on selection', async () => {
      const { user } = setup(<FeedingAdjustmentModal {...defaultProps} />);

      // Initially shows "Apply All"
      expect(screen.getByText('Apply All (2)')).toBeOnTheScreen();

      // Deselect one task
      const firstTask = screen.getByTestId('task-adjustment-task-1');
      await user.press(firstTask);

      // Should now show "Apply Selected"
      expect(screen.getByText('Apply Selected (1)')).toBeOnTheScreen();
    });

    test('visual feedback on task selection', async () => {
      const { user } = setup(<FeedingAdjustmentModal {...defaultProps} />);

      const firstTask = screen.getByTestId('task-adjustment-task-1');

      // Initially selected (opacity 100)
      expect(firstTask).toHaveStyle({ opacity: 1 });

      // Deselect
      await user.press(firstTask);

      // Should be visually dimmed (opacity 60)
      expect(firstTask).toHaveStyle({ opacity: 0.6 });
    });
  });

  describe('User Actions', () => {
    test('calls onConfirm with all adjustments when all selected', async () => {
      const onConfirm = jest.fn().mockResolvedValue(undefined);
      const { user } = setup(
        <FeedingAdjustmentModal {...defaultProps} onConfirm={onConfirm} />
      );

      const confirmButton = screen.getByTestId('confirm-adjustments-button');
      await user.press(confirmButton);

      expect(onConfirm).toHaveBeenCalledWith(mockAdjustments);
    });

    test('calls onConfirm with selected adjustments only', async () => {
      const onConfirm = jest.fn().mockResolvedValue(undefined);
      const { user } = setup(
        <FeedingAdjustmentModal {...defaultProps} onConfirm={onConfirm} />
      );

      // Deselect first task
      const firstTask = screen.getByTestId('task-adjustment-task-1');
      await user.press(firstTask);

      // Confirm selected
      const confirmButton = screen.getByTestId('confirm-adjustments-button');
      await user.press(confirmButton);

      expect(onConfirm).toHaveBeenCalledWith([mockAdjustments[1]]);
    });

    test('calls onCancel when cancel button pressed', async () => {
      const onCancel = jest.fn();
      const { user } = setup(
        <FeedingAdjustmentModal {...defaultProps} onCancel={onCancel} />
      );

      const cancelButton = screen.getByTestId('cancel-adjustments-button');
      await user.press(cancelButton);

      expect(onCancel).toHaveBeenCalled();
    });

    test('disables confirm button when no tasks selected', async () => {
      const { user } = setup(<FeedingAdjustmentModal {...defaultProps} />);

      // Deselect all tasks
      const firstTask = screen.getByTestId('task-adjustment-task-1');
      const secondTask = screen.getByTestId('task-adjustment-task-2');
      await user.press(firstTask);
      await user.press(secondTask);

      const confirmButton = screen.getByTestId('confirm-adjustments-button');
      expect(confirmButton).toBeDisabled();
    });

    test('shows loading state during confirmation', async () => {
      const onConfirm = jest
        .fn()
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(resolve, 100))
        );
      const { user } = setup(
        <FeedingAdjustmentModal {...defaultProps} onConfirm={onConfirm} />
      );

      const confirmButton = screen.getByTestId('confirm-adjustments-button');
      await user.press(confirmButton);

      // Button should be disabled during loading
      expect(confirmButton).toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    test('task rows have proper accessibility roles', () => {
      setup(<FeedingAdjustmentModal {...defaultProps} />);

      const firstTask = screen.getByTestId('task-adjustment-task-1');
      expect(firstTask.props.accessibilityRole).toBe('checkbox');
    });

    test('close button has accessibility label', () => {
      setup(<FeedingAdjustmentModal {...defaultProps} />);

      const closeButton = screen.getByTestId('close-button');
      expect(closeButton.props.accessibilityLabel).toBe('Close modal');
    });

    test('task rows have descriptive labels', () => {
      setup(<FeedingAdjustmentModal {...defaultProps} />);

      const firstTask = screen.getByTestId('task-adjustment-task-1');
      expect(firstTask.props.accessibilityLabel).toBe(
        'Feed - veg phase, EC is too high, dilute next feeding by 10%'
      );
    });
  });

  describe('Edge Cases', () => {
    test('handles single task adjustment', () => {
      const singleTaskProposal: AdjustmentProposal = {
        ...mockProposal,
        proposedAdjustments: [mockAdjustments[0]],
        affectedTaskCount: 1,
      };

      setup(
        <FeedingAdjustmentModal
          {...defaultProps}
          proposal={singleTaskProposal}
        />
      );

      expect(screen.getByText('1 task affected')).toBeOnTheScreen();
      expect(screen.getByText('1 of 1 selected')).toBeOnTheScreen();
    });

    test('resets selection when proposal changes', () => {
      const { rerender } = setup(<FeedingAdjustmentModal {...defaultProps} />);

      // New proposal with different adjustments
      const newProposal: AdjustmentProposal = {
        ...mockProposal,
        proposedAdjustments: [mockAdjustments[0]],
        affectedTaskCount: 1,
      };

      rerender(
        <FeedingAdjustmentModal {...defaultProps} proposal={newProposal} />
      );

      // Should show 1 of 1 selected (reset and all selected)
      expect(screen.getByText('1 of 1 selected')).toBeOnTheScreen();
    });

    test('handles confirmation errors gracefully', async () => {
      const onConfirm = jest.fn().mockRejectedValue(new Error('Network error'));
      const { user } = setup(
        <FeedingAdjustmentModal {...defaultProps} onConfirm={onConfirm} />
      );

      const confirmButton = screen.getByTestId('confirm-adjustments-button');
      await user.press(confirmButton);

      // Error is logged but modal remains open
      expect(onConfirm).toHaveBeenCalled();
      // Confirm button should be enabled again after error
      expect(confirmButton).not.toBeDisabled();
    });
  });

  describe('Severity Indicators', () => {
    test('applies correct styling for medium severity', () => {
      setup(<FeedingAdjustmentModal {...defaultProps} />);

      const mediumTask = screen.getByTestId('task-adjustment-task-1');
      expect(mediumTask.props.className).toContain('bg-warning-100');
    });

    test('applies correct styling for high severity', () => {
      setup(<FeedingAdjustmentModal {...defaultProps} />);

      const highTask = screen.getByTestId('task-adjustment-task-2');
      expect(highTask.props.className).toContain('bg-danger-100');
    });
  });
});
