import { useRouter } from 'expo-router';
import React from 'react';

import type { ActivationAction } from '@/lib/compliance/activation-state';
import {
  completeActivationAction,
  dismissActivationChecklist,
  resetActivationState,
} from '@/lib/compliance/activation-state';
import { cleanup, screen, setup, waitFor } from '@/lib/test-utils';

import { ActivationChecklist } from './activation-checklist';

// Mock expo-router
jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
}));

// Mock analytics
jest.mock('@/lib', () => ({
  useAnalytics: jest.fn(() => ({
    track: jest.fn(),
  })),
}));

// Mock consent manager
jest.mock('@/lib/privacy/consent-manager', () => ({
  consentManager: {
    hasConsented: jest.fn(() => true),
    onConsentChanged: jest.fn(() => jest.fn()), // Return unsubscribe function
  },
}));

const mockPush = jest.fn();
const mockOnActionComplete = jest.fn<void, [ActivationAction]>();

describe('ActivationChecklist', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetActivationState();
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
  });

  afterEach(cleanup);

  describe('Rendering', () => {
    test('renders correctly when checklist should be shown', async () => {
      setup(<ActivationChecklist />);

      expect(
        await screen.findByTestId('activation-checklist')
      ).toBeOnTheScreen();
      expect(
        await screen.findByText('Get started with GrowBro')
      ).toBeOnTheScreen();
    });

    test('does not render when checklist is dismissed', async () => {
      dismissActivationChecklist();

      setup(<ActivationChecklist />);

      await waitFor(() => {
        expect(
          screen.queryByTestId('activation-checklist')
        ).not.toBeOnTheScreen();
      });
    });

    test('does not render when 2+ actions completed', async () => {
      completeActivationAction('create-task');
      completeActivationAction('try-ai-diagnosis');

      setup(<ActivationChecklist />);

      await waitFor(() => {
        expect(
          screen.queryByTestId('activation-checklist')
        ).not.toBeOnTheScreen();
      });
    });

    test('renders all 3 action items', async () => {
      setup(<ActivationChecklist />);

      expect(
        await screen.findByTestId('activation-action-create-task')
      ).toBeOnTheScreen();
      expect(
        await screen.findByTestId('activation-action-try-ai-diagnosis')
      ).toBeOnTheScreen();
      expect(
        await screen.findByTestId('activation-action-explore-strains')
      ).toBeOnTheScreen();
    });

    test('shows progress count', async () => {
      setup(<ActivationChecklist />);

      expect(await screen.findByText('0 of 3 completed')).toBeOnTheScreen();
    });

    test('updates progress when action completed', async () => {
      const { rerender } = setup(<ActivationChecklist />);

      completeActivationAction('create-task');
      rerender(<ActivationChecklist />);

      await waitFor(() => {
        expect(screen.getByText('1 of 3 completed')).toBeOnTheScreen();
      });
    });
  });

  describe('Action Items', () => {
    test('action items are pressable when not completed', async () => {
      const { user } = setup(
        <ActivationChecklist onActionComplete={mockOnActionComplete} />
      );

      const createTaskButton = await screen.findByTestId(
        'activation-action-create-task'
      );
      await user.press(createTaskButton);

      expect(mockPush).toHaveBeenCalledWith('/calendar');
      expect(mockOnActionComplete).toHaveBeenCalledWith('create-task');
    });

    test('completed actions show checkmark', async () => {
      completeActivationAction('create-task');

      setup(<ActivationChecklist />);

      const createTaskButton = await screen.findByTestId(
        'activation-action-create-task'
      );
      expect(createTaskButton).toBeDisabled();
    });

    test('navigates to correct routes', async () => {
      const { user } = setup(<ActivationChecklist />);

      const actions = [
        { testId: 'activation-action-create-task', route: '/calendar' },
        {
          testId: 'activation-action-try-ai-diagnosis',
          route: '/assessment/capture',
        },
        { testId: 'activation-action-explore-strains', route: '/strains' },
      ];

      for (const action of actions) {
        const button = await screen.findByTestId(action.testId);
        await user.press(button);
        expect(mockPush).toHaveBeenCalledWith(action.route);
        mockPush.mockClear();
      }
    });
  });

  describe('Dismiss Button', () => {
    test('dismiss button is visible', async () => {
      setup(<ActivationChecklist />);

      expect(await screen.findByTestId('activation-dismiss')).toBeOnTheScreen();
    });

    test('dismisses checklist when pressed', async () => {
      const { user } = setup(<ActivationChecklist />);

      const dismissButton = await screen.findByTestId('activation-dismiss');
      await user.press(dismissButton);

      await waitFor(() => {
        expect(
          screen.queryByTestId('activation-checklist')
        ).not.toBeOnTheScreen();
      });
    });
  });

  describe('Accessibility', () => {
    test('has proper accessibility labels', async () => {
      setup(<ActivationChecklist />);

      const createTaskButton = await screen.findByTestId(
        'activation-action-create-task'
      );
      expect(createTaskButton).toBeOnTheScreen();
      expect(createTaskButton.props.accessibilityRole).toBe('button');
      expect(createTaskButton.props.accessibilityLabel).toBe(
        'Create your first task'
      );
    });

    test('completed actions are marked as disabled', async () => {
      completeActivationAction('create-task');

      setup(<ActivationChecklist />);

      const createTaskButton = await screen.findByTestId(
        'activation-action-create-task'
      );
      expect(createTaskButton).toBeDisabled();
    });

    test('dismiss button has accessibility label', async () => {
      setup(<ActivationChecklist />);

      const dismissButton = await screen.findByTestId('activation-dismiss');
      expect(dismissButton).toBeOnTheScreen();
      expect(dismissButton.props.accessibilityRole).toBe('button');
      expect(dismissButton.props.accessibilityLabel).toBe('Dismiss');
    });
  });

  describe('Callback Integration', () => {
    test('calls onActionComplete callback when action pressed', async () => {
      const { user } = setup(
        <ActivationChecklist onActionComplete={mockOnActionComplete} />
      );

      const createTaskButton = await screen.findByTestId(
        'activation-action-create-task'
      );
      await user.press(createTaskButton);

      expect(mockOnActionComplete).toHaveBeenCalledWith('create-task');
      expect(mockOnActionComplete).toHaveBeenCalledTimes(1);
    });

    test('does not crash when onActionComplete is not provided', async () => {
      const { user } = setup(<ActivationChecklist />);

      const createTaskButton = await screen.findByTestId(
        'activation-action-create-task'
      );
      await user.press(createTaskButton);

      expect(mockPush).toHaveBeenCalledWith('/calendar');
    });
  });
});
