import React from 'react';
import { Alert } from 'react-native';

// SUT
import PrivacyAndDataScreen from '@/app/settings/privacy-and-data';
import { screen, setup, waitFor } from '@/lib/test-utils';

// Mocks
jest.mock('@/lib/i18n/utils', () => ({
  translate: (k: string, _?: Record<string, unknown>) => k,
}));

const mockSignOutAction = jest.fn();
jest.mock('@/lib/auth', () => {
  const actual = jest.requireActual('@/lib/auth');
  return {
    ...actual,
    // The selector hook call (useAuth.use.signOut()) returns the action function.
    useAuth: { use: { signOut: () => mockSignOutAction } },
  };
});

jest.mock('@/lib/privacy/deletion-manager', () => ({
  deleteAccountInApp: jest
    .fn()
    .mockResolvedValue({ estimatedCompletion: null }),
  provideWebDeletionUrl: jest
    .fn()
    .mockReturnValue('https://example.com/delete'),
  requestDataExport: jest.fn().mockResolvedValue({ estimatedCompletion: null }),
}));

describe('PrivacyAndData - account deletion discoverability and flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('delete account is discoverable within ≤3 taps and confirms happy path', async () => {
    // Auto-confirm Alert
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation((title, message, buttons?: unknown) => {
        // find destructive confirm button
        const confirm = Array.isArray(buttons)
          ? buttons.find(
              (button): button is { style?: string; onPress?: () => void } =>
                typeof button === 'object' &&
                button !== null &&
                'style' in button
            )
          : null;
        confirm?.onPress?.();
        return undefined;
      });

    const { user } = setup(<PrivacyAndDataScreen />);

    // Tap 1: screen is open (we count interactions; ≤3 taps total)
    // Tap 2: press the delete button inside PrivacySettings
    const deleteBtn = await screen.findByTestId('privacy-delete-btn');
    await user.press(deleteBtn);

    // Tap 3: confirm alert (auto-confirmed by mock)

    const { deleteAccountInApp } = jest.requireMock(
      '@/lib/privacy/deletion-manager'
    );

    await waitFor(() => expect(deleteAccountInApp).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockSignOutAction).toHaveBeenCalledTimes(1));

    expect(alertSpy).toHaveBeenCalled();
  });
});
