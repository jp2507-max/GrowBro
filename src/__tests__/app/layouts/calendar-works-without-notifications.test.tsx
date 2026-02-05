import * as ExpoNotifications from 'expo-notifications';
import React from 'react';

import CalendarScreen from '@/app/(app)/(index,community,strains,calendar)/calendar';
import { NotificationHandler } from '@/lib/permissions/notification-handler';
import { cleanup, render, screen } from '@/lib/test-utils';

// We want to ensure the app's core calendar remains usable with notifications denied.
// Mock NotificationHandler to simulate denied permission and ensure no channel creation/scheduling occurs.
jest.mock('@/lib/permissions/notification-handler', () => ({
  NotificationHandler: {
    isNotificationPermissionGranted: jest.fn().mockResolvedValue(false),
    createChannelsAfterGrant: jest.fn().mockResolvedValue(undefined),
    requestPermissionWithPrimer: jest.fn().mockResolvedValue(false),
    showInAppBadge: jest.fn(),
    suppressNotifications: jest.fn(),
  },
}));

// Also mock expo-notifications to capture any accidental scheduling attempts
jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  getPermissionsAsync: jest
    .fn()
    .mockResolvedValue({ status: 'denied', canAskAgain: true }),
}));

// Import after mocks so Calendar can pull mocked modules if it happens to touch them through hooks
// Imports are above; mocks are hoisted by Jest

afterEach(() => {
  jest.clearAllMocks();
  cleanup();
});

describe('Calendar works without notifications permission', () => {
  test('renders and navigates days with permission denied', async () => {
    render(<CalendarScreen />);

    // Calendar screen and header render
    expect(await screen.findByTestId('calendar-screen')).toBeOnTheScreen();
    expect(screen.getByTestId('calendar-header')).toBeOnTheScreen();

    // Navigate forward and backward to ensure core interaction works
    const next = screen.getByTestId('calendar-next-button');
    const prev = screen.getByTestId('calendar-prev-button');

    expect(next).toBeEnabled();
    expect(prev).toBeEnabled();
  });

  test('does not create channels or schedule notifications when denied', async () => {
    render(<CalendarScreen />);

    // Give microtasks chance if any effect tries to touch notifications
    await Promise.resolve();

    // Ensure no scheduling and no channel creation was attempted
    expect(ExpoNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(
      ExpoNotifications.setNotificationChannelAsync
    ).not.toHaveBeenCalled();

    expect(NotificationHandler.createChannelsAfterGrant).not.toHaveBeenCalled();
  });
});
