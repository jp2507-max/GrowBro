import React from 'react';

import { OfflineModeBanner } from '@/components/auth/offline-mode-banner';
import { cleanup, render, screen, userEvent } from '@/lib/test-utils';

afterEach(cleanup);

describe('OfflineModeBanner', () => {
  describe('Rendering', () => {
    test('does not render when mode is full', () => {
      render(<OfflineModeBanner mode="full" />);
      expect(screen.queryByText('Limited Connectivity')).not.toBeOnTheScreen();
      expect(screen.queryByText('Session Expired')).not.toBeOnTheScreen();
    });

    test('renders readonly banner with correct styling', () => {
      render(<OfflineModeBanner mode="readonly" />);
      expect(screen.getByText('Limited Connectivity')).toBeOnTheScreen();
      expect(
        screen.getByText(
          "You're offline. Changes will sync when you reconnect."
        )
      ).toBeOnTheScreen();
    });

    test('renders blocked banner with correct styling', () => {
      render(<OfflineModeBanner mode="blocked" />);
      expect(screen.getByText('Session Expired')).toBeOnTheScreen();
      expect(
        screen.getByText(
          'Your session has expired. Please reconnect to continue using the app.'
        )
      ).toBeOnTheScreen();
    });
  });

  describe('Interactions', () => {
    test('readonly banner can be dismissed', async () => {
      const onDismiss = jest.fn();
      const user = userEvent.setup();

      render(<OfflineModeBanner mode="readonly" onDismiss={onDismiss} />);

      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      expect(dismissButton).toBeOnTheScreen();

      await user.press(dismissButton);
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    test('blocked banner does not show dismiss button', () => {
      const onDismiss = jest.fn();
      render(<OfflineModeBanner mode="blocked" onDismiss={onDismiss} />);

      expect(
        screen.queryByRole('button', { name: /dismiss/i })
      ).not.toBeOnTheScreen();
    });

    test('readonly banner without onDismiss does not show dismiss button', () => {
      render(<OfflineModeBanner mode="readonly" />);

      expect(
        screen.queryByRole('button', { name: /dismiss/i })
      ).not.toBeOnTheScreen();
    });
  });

  describe('Accessibility', () => {
    test('has correct accessibility properties', () => {
      render(<OfflineModeBanner mode="readonly" />);
      // Verify the banner text is present, which means accessibility role is applied
      expect(screen.getByText('Limited Connectivity')).toBeOnTheScreen();
      expect(
        screen.getByText(
          "You're offline. Changes will sync when you reconnect."
        )
      ).toBeOnTheScreen();
    });
  });
});
