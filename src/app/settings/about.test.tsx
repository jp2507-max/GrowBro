import * as Updates from 'expo-updates';
import React from 'react';
import { Alert, Linking } from 'react-native';

import { showErrorMessage } from '@/lib/flash-message';
import { translate } from '@/lib/i18n';
import { cleanup, render, screen, setup, waitFor } from '@/lib/test-utils';

// Import component after mocks
import AboutScreen from './about';

// Mock dependencies before import
jest.mock('expo-updates');
jest.mock('@/lib/flash-message', () => ({
  showErrorMessage: jest.fn(),
}));
jest.mock('@/lib/storage', () => ({
  storage: {
    set: jest.fn(),
    getString: jest.fn(),
    delete: jest.fn(),
  },
}));
jest.mock('@/lib/compliance/onboarding-state', () => ({
  resetOnboardingState: jest.fn(),
}));
jest.mock('@/lib/compliance/onboarding-telemetry', () => ({
  trackOnboardingStart: jest.fn(),
}));
jest.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      version: '0.0.1',
      extra: {
        eas: {
          projectId: 'test-project-id',
        },
      },
    },
  },
}));
jest.mock('@env', () => ({
  Env: {
    NAME: 'GrowBro',
    VERSION: '0.0.1',
    PACKAGE: 'com.growbro.app',
    APP_ENV: 'development',
  },
}));

const mockCheckForUpdateAsync = Updates.checkForUpdateAsync as jest.Mock;
const mockFetchUpdateAsync = Updates.fetchUpdateAsync as jest.Mock;
const mockReloadAsync = Updates.reloadAsync as jest.Mock;

describe('AboutScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: OTA enabled
    (Updates as { isEnabled: boolean }).isEnabled = true;
  });

  afterEach(cleanup);

  describe('Rendering', () => {
    test('renders app information correctly', async () => {
      render(<AboutScreen />);

      expect(await screen.findByText(/app information/i)).toBeOnTheScreen();
      expect(screen.getByText(/GrowBro/i)).toBeOnTheScreen();
      expect(screen.getByText(/0\.0\.1/i)).toBeOnTheScreen();
    });

    test('renders check for updates button', async () => {
      render(<AboutScreen />);

      expect(await screen.findByText(/check for updates/i)).toBeOnTheScreen();
    });

    test('renders links section', async () => {
      render(<AboutScreen />);

      expect(await screen.findByText(/website/i)).toBeOnTheScreen();
      expect(screen.getByText(/github/i)).toBeOnTheScreen();
    });

    test('renders copyright information', async () => {
      const currentYear = new Date().getFullYear();
      render(<AboutScreen />);

      expect(
        await screen.findByText(new RegExp(`© ${currentYear} GrowBro`, 'i'))
      ).toBeOnTheScreen();
    });

    test('renders onboarding section', async () => {
      render(<AboutScreen />);

      expect(await screen.findByText(/onboarding/i)).toBeOnTheScreen();
      expect(screen.getByText(/rewatch onboarding/i)).toBeOnTheScreen();
    });
  });

  describe('Onboarding', () => {
    test('shows alert when rewatch onboarding pressed', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert');

      const { user } = setup(<AboutScreen />);

      const rewatchButton = await screen.findByText(/rewatch onboarding/i);
      await user.press(rewatchButton);

      expect(alertSpy).toHaveBeenCalledWith(
        translate('settings.about.rewatch_onboarding_title'),
        translate('settings.about.rewatch_onboarding_message'),
        expect.any(Array)
      );
    });

    test('resets onboarding state and navigates when confirm pressed', async () => {
      const alertSpy = jest
        .spyOn(Alert, 'alert')
        .mockImplementation((title, message, buttons) => {
          // Simulate pressing the confirm button
          const confirmButton = buttons?.[1];
          if (confirmButton && confirmButton.onPress) {
            confirmButton.onPress();
          }
        });

      const {
        resetOnboardingState,
      } = require('@/lib/compliance/onboarding-state');
      const {
        trackOnboardingStart,
      } = require('@/lib/compliance/onboarding-telemetry');
      const { storage } = require('@/lib/storage');

      const { user } = setup(<AboutScreen />);

      const rewatchButton = await screen.findByText(/rewatch onboarding/i);
      await user.press(rewatchButton);

      expect(resetOnboardingState).toHaveBeenCalled();
      expect(storage.set).toHaveBeenCalledWith('IS_FIRST_TIME', true);
      expect(trackOnboardingStart).toHaveBeenCalledWith('manual');

      alertSpy.mockRestore();
    });
  });

  describe('OTA Updates - Enabled', () => {
    test('checks for updates when button pressed', async () => {
      mockCheckForUpdateAsync.mockResolvedValue({
        isAvailable: false,
      });

      const { user } = setup(<AboutScreen />);

      const button = await screen.findByText(/check for updates/i);
      await user.press(button);

      await waitFor(() => {
        expect(mockCheckForUpdateAsync).toHaveBeenCalledTimes(1);
      });
    });

    test('displays up-to-date message when no update available', async () => {
      mockCheckForUpdateAsync.mockResolvedValue({
        isAvailable: false,
      });

      const { user } = setup(<AboutScreen />);

      const button = await screen.findByText(/check for updates/i);
      await user.press(button);

      await waitFor(() => {
        expect(screen.getByText(/up to date/i)).toBeOnTheScreen();
      });
    });

    test('displays update available when update exists', async () => {
      const mockManifest = {
        createdAt: '2024-01-01T00:00:00Z',
      };

      mockCheckForUpdateAsync.mockResolvedValue({
        isAvailable: true,
        manifest: mockManifest,
      });

      const { user } = setup(<AboutScreen />);

      const button = await screen.findByText(/check for updates/i);
      await user.press(button);

      await waitFor(() => {
        expect(screen.getByText(/update available/i)).toBeOnTheScreen();
      });
    });

    test('downloads update when download button pressed', async () => {
      mockCheckForUpdateAsync.mockResolvedValue({
        isAvailable: true,
        manifest: { createdAt: '2024-01-01T00:00:00Z' },
      });
      mockFetchUpdateAsync.mockResolvedValue({});

      const { user } = setup(<AboutScreen />);

      // First check for updates
      const checkButton = await screen.findByText(/check for updates/i);
      await user.press(checkButton);

      // Wait for update available state
      await waitFor(() => {
        expect(screen.getByText(/download update/i)).toBeOnTheScreen();
      });

      // Press download button
      const downloadButton = screen.getByText(/download update/i);
      await user.press(downloadButton);

      await waitFor(() => {
        expect(mockFetchUpdateAsync).toHaveBeenCalledTimes(1);
      });
    });

    test('shows restart button after successful download', async () => {
      mockCheckForUpdateAsync.mockResolvedValue({
        isAvailable: true,
        manifest: { createdAt: '2024-01-01T00:00:00Z' },
      });
      mockFetchUpdateAsync.mockResolvedValue({});

      const { user } = setup(<AboutScreen />);

      const checkButton = await screen.findByText(/check for updates/i);
      await user.press(checkButton);

      await waitFor(() => {
        expect(screen.getByText(/download update/i)).toBeOnTheScreen();
      });

      const downloadButton = screen.getByText(/download update/i);
      await user.press(downloadButton);

      await waitFor(() => {
        expect(screen.getByText(/restart to apply/i)).toBeOnTheScreen();
      });
    });

    test('restarts app when restart button pressed', async () => {
      mockCheckForUpdateAsync.mockResolvedValue({
        isAvailable: true,
        manifest: { createdAt: '2024-01-01T00:00:00Z' },
      });
      mockFetchUpdateAsync.mockResolvedValue({});
      mockReloadAsync.mockResolvedValue(undefined);

      const { user } = setup(<AboutScreen />);

      const checkButton = await screen.findByText(/check for updates/i);
      await user.press(checkButton);

      await waitFor(() => {
        expect(screen.getByText(/download update/i)).toBeOnTheScreen();
      });

      const downloadButton = screen.getByText(/download update/i);
      await user.press(downloadButton);

      await waitFor(() => {
        expect(screen.getByText(/restart to apply/i)).toBeOnTheScreen();
      });

      const restartButton = screen.getByText(/restart to apply/i);
      await user.press(restartButton);

      await waitFor(() => {
        expect(mockReloadAsync).toHaveBeenCalledTimes(1);
      });
    });

    test('handles check update error gracefully', async () => {
      mockCheckForUpdateAsync.mockRejectedValue(new Error('Network error'));

      const { user } = setup(<AboutScreen />);

      const button = await screen.findByText(/check for updates/i);
      await user.press(button);

      await waitFor(() => {
        expect(
          screen.getByText(/error checking for updates/i)
        ).toBeOnTheScreen();
      });
    });

    test('handles download error gracefully', async () => {
      mockCheckForUpdateAsync.mockResolvedValue({
        isAvailable: true,
        manifest: { createdAt: '2024-01-01T00:00:00Z' },
      });
      mockFetchUpdateAsync.mockRejectedValue(new Error('Download failed'));

      const { user } = setup(<AboutScreen />);

      const checkButton = await screen.findByText(/check for updates/i);
      await user.press(checkButton);

      await waitFor(() => {
        expect(screen.getByText(/download update/i)).toBeOnTheScreen();
      });

      const downloadButton = screen.getByText(/download update/i);
      await user.press(downloadButton);

      await waitFor(() => {
        expect(
          screen.getByText(/error checking for updates/i)
        ).toBeOnTheScreen();
      });
    });
  });

  describe('OTA Updates - Disabled', () => {
    beforeEach(() => {
      (Updates as { isEnabled: boolean }).isEnabled = false;
    });

    test('shows store managed message when OTA disabled', async () => {
      render(<AboutScreen />);

      expect(
        await screen.findByText(/updates are managed through the app store/i)
      ).toBeOnTheScreen();
    });

    test('opens app store when check for updates pressed and OTA disabled', async () => {
      const openURLSpy = jest.spyOn(Linking, 'openURL');

      const { user } = setup(<AboutScreen />);

      const button = await screen.findByText(/check for updates/i);
      await user.press(button);

      await waitFor(() => {
        expect(openURLSpy).toHaveBeenCalledWith(
          'https://play.google.com/store/apps/details?id=com.growbro.app'
        );
      });
    });

    test('shows error when opening app store fails', async () => {
      const openURLMock = jest
        .spyOn(Linking, 'openURL')
        .mockRejectedValue(new Error('Cannot open URL'));
      const alertSpy = jest.spyOn(Alert, 'alert');

      const { user } = setup(<AboutScreen />);

      const button = await screen.findByText(/check for updates/i);
      await user.press(button);

      await waitFor(() => {
        expect(openURLMock).toHaveBeenCalledWith(
          'https://play.google.com/store/apps/details?id=com.growbro.app'
        );
        expect(alertSpy).toHaveBeenCalledWith(
          'Error',
          'Failed to open app store. Please try again or check your device settings.'
        );
      });

      // Restore mocks
      openURLMock.mockRestore();
      alertSpy.mockRestore();
    });
  });

  describe('Offline Behavior', () => {
    test('shows offline badge when offline', async () => {
      // Mock network status to offline before importing AboutScreen
      jest.resetModules();
      jest.doMock('@/lib/hooks/use-network-status', () => ({
        useNetworkStatus: () => ({
          isInternetReachable: false,
        }),
      }));

      // Import AboutScreen after mocking
      const AboutScreen = (await import('./about')).default;

      render(<AboutScreen />);

      // Links should show offline badge
      expect(await screen.findByText(/offline/i)).toBeOnTheScreen();
    });
  });

  describe('Links', () => {
    test('opens website when website link pressed', async () => {
      const openURLSpy = jest
        .spyOn(Linking, 'openURL')
        .mockResolvedValue(undefined);

      const { user } = setup(<AboutScreen />);

      const websiteItem = await screen.findByText(/website/i);
      await user.press(websiteItem);

      await waitFor(() => {
        expect(openURLSpy).toHaveBeenCalledWith('https://growbro.app');
      });
    });

    test('opens github when github link pressed', async () => {
      const openURLSpy = jest
        .spyOn(Linking, 'openURL')
        .mockResolvedValue(undefined);

      const { user } = setup(<AboutScreen />);

      const githubItem = await screen.findByText(/github/i);
      await user.press(githubItem);

      await waitFor(() => {
        expect(openURLSpy).toHaveBeenCalledWith(
          'https://github.com/jp2507-max/GrowBro'
        );
      });
    });

    test('handles website link error gracefully', async () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      jest
        .spyOn(Linking, 'openURL')
        .mockRejectedValue(new Error('Link failed'));

      const { user } = setup(<AboutScreen />);

      const websiteItem = await screen.findByText(/website/i);
      await user.press(websiteItem);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to open website:',
          expect.any(Error)
        );
        expect(showErrorMessage).toHaveBeenCalledWith(
          translate('settings.about.open_link_error')
        );
      });

      consoleErrorSpy.mockRestore();
    });

    test('handles github link error gracefully', async () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      jest
        .spyOn(Linking, 'openURL')
        .mockRejectedValue(new Error('Link failed'));

      const { user } = setup(<AboutScreen />);

      const githubItem = await screen.findByText(/github/i);
      await user.press(githubItem);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to open GitHub:',
          expect.any(Error)
        );
        expect(showErrorMessage).toHaveBeenCalledWith(
          translate('settings.about.open_link_error')
        );
      });

      consoleErrorSpy.mockRestore();
    });
  });
});
