import React from 'react';
import { Alert } from 'react-native';

import type { UserSession } from '@/api/auth';
import * as authApi from '@/api/auth';
import ActiveSessionsScreen from '@/app/settings/active-sessions';
import { cleanup, render, screen, userEvent, waitFor } from '@/lib/test-utils';

// Mock the auth API hooks
jest.mock('@/api/auth');

// Mock Alert
jest.spyOn(Alert, 'alert');

// Mock useAuth hook
jest.mock('@/lib/auth', () => ({
  useAuth: {
    use: {
      getStableSessionId: jest.fn(() => 'current-session-key'),
    },
  },
}));

const mockSessions: UserSession[] = [
  {
    id: '1',
    user_id: 'user-123',
    session_key: 'current-session-key',
    device_name: 'iPhone 14 Pro',
    device_os: 'iOS 17.1',
    app_version: '1.0.0',
    ip_address_truncated: '192.168.1.xxx',
    last_active_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    revoked_at: null,
  },
  {
    id: '2',
    user_id: 'user-123',
    session_key: 'other-session-key',
    device_name: 'MacBook Pro',
    device_os: 'macOS 14.0',
    app_version: '1.0.0',
    ip_address_truncated: '10.0.0.xxx',
    last_active_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    revoked_at: null,
  },
];

type UseSessionsResult = ReturnType<typeof authApi.useSessions>;
type UseRevokeSessionResult = ReturnType<typeof authApi.useRevokeSession>;
type UseRevokeAllOtherSessionsResult = ReturnType<
  typeof authApi.useRevokeAllOtherSessions
>;

const createSessionsResult = (
  overrides: Partial<UseSessionsResult> = {}
): UseSessionsResult => {
  const base = {
    data: undefined,
    isLoading: false,
    isError: false,
    isSuccess: false,
    isPending: false,
    error: null,
    refetch: jest.fn(),
  } as unknown as UseSessionsResult;

  return Object.assign(base, overrides);
};

const createRevokeSessionResult = (
  mutate: jest.Mock = jest.fn(),
  overrides: Partial<UseRevokeSessionResult> = {}
): UseRevokeSessionResult => {
  const base = {
    mutate,
    isPending: false,
    isError: false,
    isSuccess: false,
    data: undefined,
    error: null,
    variables: undefined,
    reset: jest.fn(),
  } as unknown as UseRevokeSessionResult;

  return Object.assign(base, overrides);
};

const createRevokeAllOtherSessionsResult = (
  mutate: jest.Mock = jest.fn(),
  overrides: Partial<UseRevokeAllOtherSessionsResult> = {}
): UseRevokeAllOtherSessionsResult => {
  const base = {
    mutate,
    isPending: false,
    isError: false,
    isSuccess: false,
    data: undefined,
    error: null,
    variables: undefined,
    reset: jest.fn(),
  } as unknown as UseRevokeAllOtherSessionsResult;

  return Object.assign(base, overrides);
};

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

describe('ActiveSessionsScreen', () => {
  describe('Rendering', () => {
    test('displays loading state initially', () => {
      jest
        .mocked(authApi.useSessions)
        .mockReturnValue(createSessionsResult({ isLoading: true }));
      jest
        .mocked(authApi.useRevokeSession)
        .mockReturnValue(createRevokeSessionResult());
      jest
        .mocked(authApi.useRevokeAllOtherSessions)
        .mockReturnValue(createRevokeAllOtherSessionsResult());

      render(<ActiveSessionsScreen />);

      expect(screen.getByTestId('activity-indicator')).toBeOnTheScreen();
    });

    test('displays sessions list when loaded', async () => {
      jest
        .mocked(authApi.useSessions)
        .mockReturnValue(createSessionsResult({ data: mockSessions }));
      jest
        .mocked(authApi.useRevokeSession)
        .mockReturnValue(createRevokeSessionResult());
      jest
        .mocked(authApi.useRevokeAllOtherSessions)
        .mockReturnValue(createRevokeAllOtherSessionsResult());

      render(<ActiveSessionsScreen />);

      await waitFor(() => {
        expect(screen.getByText('iPhone 14 Pro')).toBeOnTheScreen();
      });
      expect(screen.getByText('MacBook Pro')).toBeOnTheScreen();
    });

    test('highlights current session', async () => {
      jest
        .mocked(authApi.useSessions)
        .mockReturnValue(createSessionsResult({ data: mockSessions }));
      jest
        .mocked(authApi.useRevokeSession)
        .mockReturnValue(createRevokeSessionResult());
      jest
        .mocked(authApi.useRevokeAllOtherSessions)
        .mockReturnValue(createRevokeAllOtherSessionsResult());

      render(<ActiveSessionsScreen />);

      await waitFor(() => {
        expect(screen.getByText('This Device')).toBeOnTheScreen();
      });
    });

    test('displays error state when fetch fails', () => {
      jest.mocked(authApi.useSessions).mockReturnValue(
        createSessionsResult({
          isError: true,
          error: new Error('Network error'),
        })
      );

      render(<ActiveSessionsScreen />);

      expect(
        screen.getByText('Failed to load sessions. Please try again.')
      ).toBeOnTheScreen();
    });

    test('displays empty state when no sessions', () => {
      jest
        .mocked(authApi.useSessions)
        .mockReturnValue(createSessionsResult({ data: [] }));
      jest
        .mocked(authApi.useRevokeSession)
        .mockReturnValue(createRevokeSessionResult());
      jest
        .mocked(authApi.useRevokeAllOtherSessions)
        .mockReturnValue(createRevokeAllOtherSessionsResult());

      render(<ActiveSessionsScreen />);

      expect(screen.getByText('No active sessions found.')).toBeOnTheScreen();
    });
  });

  describe('Interactions', () => {
    test('shows confirmation when revoking a session', async () => {
      const mockRevoke = jest.fn();
      jest
        .mocked(authApi.useSessions)
        .mockReturnValue(createSessionsResult({ data: mockSessions }));
      jest
        .mocked(authApi.useRevokeSession)
        .mockReturnValue(createRevokeSessionResult(mockRevoke));
      jest
        .mocked(authApi.useRevokeAllOtherSessions)
        .mockReturnValue(createRevokeAllOtherSessionsResult());

      const user = userEvent.setup();
      render(<ActiveSessionsScreen />);

      await waitFor(() => {
        expect(screen.getByText('MacBook Pro')).toBeOnTheScreen();
      });

      // Use accessibility label with device name to get the correct revoke button
      const revokeButton = screen.getByLabelText(
        'Revoke access for MacBook Pro'
      );

      await user.press(revokeButton);

      expect(Alert.alert).toHaveBeenCalledWith(
        'Revoke Session?',
        expect.stringContaining('MacBook Pro'),
        expect.any(Array)
      );
    });

    test('shows confirmation when revoking all other sessions', async () => {
      const mockRevokeAll = jest.fn();
      jest
        .mocked(authApi.useSessions)
        .mockReturnValue(createSessionsResult({ data: mockSessions }));
      jest
        .mocked(authApi.useRevokeSession)
        .mockReturnValue(createRevokeSessionResult());
      jest
        .mocked(authApi.useRevokeAllOtherSessions)
        .mockReturnValue(createRevokeAllOtherSessionsResult(mockRevokeAll));

      const user = userEvent.setup();
      render(<ActiveSessionsScreen />);

      await waitFor(() => {
        expect(
          screen.getByRole('button', {
            name: /revoke all other sessions/i,
          })
        ).toBeOnTheScreen();
      });

      const revokeAllButton = screen.getByRole('button', {
        name: /revoke all other sessions/i,
      });
      await user.press(revokeAllButton);

      expect(Alert.alert).toHaveBeenCalledWith(
        'Revoke All Other Sessions?',
        expect.any(String),
        expect.any(Array)
      );
    });

    test('does not show revoke all button when only current session exists', () => {
      jest
        .mocked(authApi.useSessions)
        .mockReturnValue(createSessionsResult({ data: [mockSessions[0]] }));
      jest
        .mocked(authApi.useRevokeSession)
        .mockReturnValue(createRevokeSessionResult());
      jest
        .mocked(authApi.useRevokeAllOtherSessions)
        .mockReturnValue(createRevokeAllOtherSessionsResult());

      render(<ActiveSessionsScreen />);

      expect(
        screen.queryByRole('button', {
          name: /revoke all other sessions/i,
        })
      ).not.toBeOnTheScreen();
    });
  });
});
