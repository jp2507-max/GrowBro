import React from 'react';

import { cleanup, screen, setup, waitFor } from '@/lib/test-utils';

import { PermissionPrimerScreen } from './permission-primer-screen';

afterEach(cleanup);

const onAllowMock = jest.fn();
const onNotNowMock = jest.fn();

const defaultProps = {
  icon: <></>,
  titleTx: 'onboarding.permissions.notifications.title' as any,
  descriptionTx: 'onboarding.permissions.notifications.description' as any,
  benefitsTx: [
    'onboarding.permissions.notifications.benefit1' as any,
    'onboarding.permissions.notifications.benefit2' as any,
    'onboarding.permissions.notifications.benefit3' as any,
  ],
  onAllow: onAllowMock,
  onNotNow: onNotNowMock,
};

describe('PermissionPrimerScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    test('renders correctly with all elements', async () => {
      setup(<PermissionPrimerScreen {...defaultProps} />);

      expect(await screen.findByTestId('permission-primer')).toBeOnTheScreen();
      expect(
        screen.getByText('onboarding.permissions.notifications.title')
      ).toBeOnTheScreen();
      expect(
        screen.getByText('onboarding.permissions.notifications.description')
      ).toBeOnTheScreen();
    });

    test('renders all benefit items', async () => {
      setup(<PermissionPrimerScreen {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText('onboarding.permissions.notifications.benefit1')
        ).toBeOnTheScreen();
        expect(
          screen.getByText('onboarding.permissions.notifications.benefit2')
        ).toBeOnTheScreen();
        expect(
          screen.getByText('onboarding.permissions.notifications.benefit3')
        ).toBeOnTheScreen();
      });
    });

    test('renders action buttons', async () => {
      setup(<PermissionPrimerScreen {...defaultProps} />);

      expect(
        await screen.findByTestId('permission-primer-allow-button')
      ).toBeOnTheScreen();
      expect(
        screen.getByTestId('permission-primer-not-now-button')
      ).toBeOnTheScreen();
    });

    test('renders privacy note', async () => {
      setup(<PermissionPrimerScreen {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText('onboarding.permissions.privacy_note')
        ).toBeOnTheScreen();
      });
    });
  });

  describe('Interactions', () => {
    test('calls onAllow when allow button is pressed', async () => {
      const { user } = setup(<PermissionPrimerScreen {...defaultProps} />);

      const allowButton = await screen.findByTestId(
        'permission-primer-allow-button'
      );
      await user.press(allowButton);

      expect(onAllowMock).toHaveBeenCalledTimes(1);
    });

    test('calls onNotNow when not now button is pressed', async () => {
      const { user } = setup(<PermissionPrimerScreen {...defaultProps} />);

      const notNowButton = await screen.findByTestId(
        'permission-primer-not-now-button'
      );
      await user.press(notNowButton);

      expect(onNotNowMock).toHaveBeenCalledTimes(1);
    });

    test('disables buttons when loading', async () => {
      setup(<PermissionPrimerScreen {...defaultProps} isLoading />);

      const allowButton = await screen.findByTestId(
        'permission-primer-allow-button'
      );
      const notNowButton = screen.getByTestId(
        'permission-primer-not-now-button'
      );

      expect(allowButton).toBeDisabled();
      expect(notNowButton).toBeDisabled();
    });

    test('shows loading state on allow button', async () => {
      setup(<PermissionPrimerScreen {...defaultProps} isLoading />);

      const allowButton = await screen.findByTestId(
        'permission-primer-allow-button'
      );

      expect(allowButton).toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    test('title has header role', async () => {
      setup(<PermissionPrimerScreen {...defaultProps} />);

      const title = await screen.findByText(
        'onboarding.permissions.notifications.title'
      );
      expect(title).toHaveProp('accessibilityRole', 'header');
    });

    test('allow button has correct accessibility label and hint', async () => {
      setup(<PermissionPrimerScreen {...defaultProps} />);

      const allowButton = await screen.findByTestId(
        'permission-primer-allow-button'
      );

      // Check that button has accessibility props
      expect(allowButton).toHaveProp('accessibilityLabel');
      expect(allowButton).toHaveProp('accessibilityHint');
    });

    test('not now button has correct accessibility label and hint', async () => {
      setup(<PermissionPrimerScreen {...defaultProps} />);

      const notNowButton = await screen.findByTestId(
        'permission-primer-not-now-button'
      );

      // Check that button has accessibility props
      expect(notNowButton).toHaveProp('accessibilityLabel');
      expect(notNowButton).toHaveProp('accessibilityHint');
    });
  });
});
