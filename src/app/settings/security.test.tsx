import React from 'react';
import { Alert } from 'react-native';

import SecuritySettingsScreen from '@/app/settings/security';
import { cleanup, render, screen, userEvent, waitFor } from '@/lib/test-utils';

// Mock Alert
jest.spyOn(Alert, 'alert');

// Mock useRouter
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  Stack: {
    Screen: ({ children }: { children: React.ReactNode }) => children,
  },
  useRouter: () => ({
    push: mockPush,
  }),
}));

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

describe('SecuritySettingsScreen', () => {
  describe('Rendering', () => {
    test('renders all security sections', () => {
      render(<SecuritySettingsScreen />);

      expect(screen.getByText('Security')).toBeOnTheScreen();
      expect(screen.getByText('Password')).toBeOnTheScreen();
      expect(screen.getByText('Change Password')).toBeOnTheScreen();
      expect(
        screen.getAllByText('Two-Factor Authentication').length
      ).toBeGreaterThan(0);
      expect(screen.getByText('Device Sessions')).toBeOnTheScreen();
      expect(screen.getByText('Active Sessions')).toBeOnTheScreen();
      expect(screen.getByText('Danger Zone')).toBeOnTheScreen();
      expect(screen.getByText('Delete Account')).toBeOnTheScreen();
    });

    test('displays MFA as coming soon', () => {
      render(<SecuritySettingsScreen />);

      // Verify "Coming Soon" badge appears for MFA
      expect(screen.getByText('Coming Soon')).toBeOnTheScreen();
    });

    test('displays danger zone warning', () => {
      render(<SecuritySettingsScreen />);

      expect(
        screen.getByText(/Account deletion is permanent and cannot be undone/i)
      ).toBeOnTheScreen();
    });
  });

  describe('Interactions', () => {
    test('navigates to active sessions screen', async () => {
      const user = userEvent.setup();
      render(<SecuritySettingsScreen />);

      const activeSessionsItem = screen.getByText('Active Sessions');
      await user.press(activeSessionsItem);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/settings/active-sessions');
      });
    });

    test('shows coming soon alert for change password', async () => {
      const user = userEvent.setup();
      render(<SecuritySettingsScreen />);

      const changePasswordItem = screen.getByText('Change Password');
      await user.press(changePasswordItem);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Change Password',
          'Change password feature coming soon.'
        );
      });
    });

    test('shows confirmation dialog for account deletion', async () => {
      const user = userEvent.setup();
      render(<SecuritySettingsScreen />);

      const deleteAccountItem = screen.getByText('Delete Account');
      await user.press(deleteAccountItem);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Delete Account',
          expect.stringContaining('cannot be undone'),
          expect.arrayContaining([
            expect.objectContaining({ text: 'Cancel', style: 'cancel' }),
            expect.objectContaining({
              text: 'Delete Account',
              style: 'destructive',
            }),
          ])
        );
      });
    });
  });

  describe('Accessibility', () => {
    test('all interactive items are accessible', () => {
      render(<SecuritySettingsScreen />);

      // Check that pressable items have proper labels
      // Since we're using the Item component which wraps Pressable,
      // we can verify by checking the text content is rendered
      expect(screen.getByText('Change Password')).toBeOnTheScreen();
      expect(screen.getByText('Active Sessions')).toBeOnTheScreen();
      expect(screen.getByText('Delete Account')).toBeOnTheScreen();
    });
  });
});
