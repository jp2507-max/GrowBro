/**
 * Tests for HarvestErrorBanner component
 * Requirement 17.3: Persistent error banners with retry/details actions
 */

import React from 'react';

import type { ErrorAction } from '@/lib/harvest/harvest-error-types';
import { cleanup, render, screen, userEvent } from '@/lib/test-utils';

import { HarvestErrorBanner } from './harvest-error-banner';

afterEach(cleanup);

describe('HarvestErrorBanner', () => {
  describe('Rendering', () => {
    it('should render with error variant by default', () => {
      render(<HarvestErrorBanner message="Test error message" />);

      expect(screen.getByTestId('harvest-error-banner')).toBeOnTheScreen();
      expect(screen.getByText('Test error message')).toBeOnTheScreen();
      expect(screen.getByText('⚠️')).toBeOnTheScreen();
    });

    it('should render with warning variant', () => {
      render(
        <HarvestErrorBanner message="Warning message" variant="warning" />
      );

      expect(screen.getByText('Warning message')).toBeOnTheScreen();
      expect(screen.getByText('⚠')).toBeOnTheScreen();
    });

    it('should render with info variant', () => {
      render(<HarvestErrorBanner message="Info message" variant="info" />);

      expect(screen.getByText('Info message')).toBeOnTheScreen();
      expect(screen.getByText('ℹ️')).toBeOnTheScreen();
    });

    it('should render without dismiss button when onDismiss not provided', () => {
      render(<HarvestErrorBanner message="Test error" />);

      expect(
        screen.queryByTestId('harvest-error-banner-dismiss')
      ).not.toBeOnTheScreen();
    });

    it('should render dismiss button when onDismiss provided', () => {
      const onDismiss = jest.fn();
      render(<HarvestErrorBanner message="Test error" onDismiss={onDismiss} />);

      expect(
        screen.getByTestId('harvest-error-banner-dismiss')
      ).toBeOnTheScreen();
    });
  });

  describe('Action Buttons', () => {
    it('should render action buttons when actions provided', () => {
      const actions: ErrorAction[] = [
        {
          label: 'Retry Now',
          action: 'retry',
          onPress: jest.fn(),
        },
        {
          label: 'View Details',
          action: 'view_details',
          onPress: jest.fn(),
        },
      ];

      render(<HarvestErrorBanner message="Test error" actions={actions} />);

      expect(screen.getByText('Retry Now')).toBeOnTheScreen();
      expect(screen.getByText('View Details')).toBeOnTheScreen();
    });

    it('should call action handler when button pressed', async () => {
      const onRetry = jest.fn();
      const actions: ErrorAction[] = [
        {
          label: 'Retry Now',
          action: 'retry',
          onPress: onRetry,
        },
      ];

      const user = userEvent.setup();
      render(<HarvestErrorBanner message="Test error" actions={actions} />);

      const retryButton = screen.getByTestId(
        'harvest-error-banner-action-retry'
      );
      await user.press(retryButton);

      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple action buttons', async () => {
      const onRetry = jest.fn();
      const onViewDetails = jest.fn();
      const actions: ErrorAction[] = [
        { label: 'Retry Now', action: 'retry', onPress: onRetry },
        {
          label: 'View Details',
          action: 'view_details',
          onPress: onViewDetails,
        },
      ];

      const user = userEvent.setup();
      render(<HarvestErrorBanner message="Test error" actions={actions} />);

      await user.press(screen.getByTestId('harvest-error-banner-action-retry'));
      await user.press(
        screen.getByTestId('harvest-error-banner-action-view_details')
      );

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onViewDetails).toHaveBeenCalledTimes(1);
    });

    it('should render re-auth action button', () => {
      const actions: ErrorAction[] = [
        {
          label: 'Sign In Again',
          action: 're_auth',
          onPress: jest.fn(),
        },
      ];

      render(
        <HarvestErrorBanner message="Session expired" actions={actions} />
      );

      expect(screen.getByText('Sign In Again')).toBeOnTheScreen();
      expect(
        screen.getByTestId('harvest-error-banner-action-re_auth')
      ).toBeOnTheScreen();
    });
  });

  describe('Dismiss Functionality', () => {
    it('should call onDismiss when dismiss button pressed', async () => {
      const onDismiss = jest.fn();
      const user = userEvent.setup();
      render(<HarvestErrorBanner message="Test error" onDismiss={onDismiss} />);

      const dismissButton = screen.getByTestId('harvest-error-banner-dismiss');
      await user.press(dismissButton);

      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('should have accessible labels for action buttons', () => {
      const actions: ErrorAction[] = [
        {
          label: 'Retry Now',
          action: 'retry',
          onPress: jest.fn(),
        },
      ];

      render(<HarvestErrorBanner message="Test error" actions={actions} />);

      const retryButton = screen.getByTestId(
        'harvest-error-banner-action-retry'
      );
      expect(retryButton).toHaveAccessibleName('Retry Now');
    });

    it('should meet minimum touch target size', () => {
      const actions: ErrorAction[] = [
        {
          label: 'Retry Now',
          action: 'retry',
          onPress: jest.fn(),
        },
      ];

      render(<HarvestErrorBanner message="Test error" actions={actions} />);

      const retryButton = screen.getByTestId(
        'harvest-error-banner-action-retry'
      );

      // Button should have min-h-[44px] class
      expect(retryButton.props.className).toContain('min-h-[44px]');
    });
  });

  describe('Custom testID', () => {
    it('should use custom testID when provided', () => {
      render(
        <HarvestErrorBanner message="Test error" testID="custom-error-banner" />
      );

      expect(screen.getByTestId('custom-error-banner')).toBeOnTheScreen();
    });
  });

  describe('Variant Styling', () => {
    it('should apply error variant styling', () => {
      render(<HarvestErrorBanner message="Error" variant="error" />);

      const container = screen.getByTestId('harvest-error-banner');
      expect(container.props.className).toContain('border-danger');
      expect(container.props.className).toContain('bg-danger');
    });

    it('should apply warning variant styling', () => {
      render(<HarvestErrorBanner message="Warning" variant="warning" />);

      const container = screen.getByTestId('harvest-error-banner');
      expect(container.props.className).toContain('border-warning');
      expect(container.props.className).toContain('bg-warning');
    });

    it('should apply info variant styling', () => {
      render(<HarvestErrorBanner message="Info" variant="info" />);

      const container = screen.getByTestId('harvest-error-banner');
      expect(container.props.className).toContain('border-primary');
      expect(container.props.className).toContain('bg-primary');
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete error scenario with retry and dismiss', async () => {
      const onRetry = jest.fn();
      const onDismiss = jest.fn();
      const actions: ErrorAction[] = [
        { label: 'Retry Now', action: 'retry', onPress: onRetry },
      ];

      const user = userEvent.setup();
      render(
        <HarvestErrorBanner
          message="Sync failed"
          actions={actions}
          onDismiss={onDismiss}
          variant="error"
        />
      );

      // Verify all elements present
      expect(screen.getByText('Sync failed')).toBeOnTheScreen();
      expect(screen.getByText('Retry Now')).toBeOnTheScreen();
      expect(
        screen.getByTestId('harvest-error-banner-dismiss')
      ).toBeOnTheScreen();

      // Test retry action
      await user.press(screen.getByTestId('harvest-error-banner-action-retry'));
      expect(onRetry).toHaveBeenCalledTimes(1);

      // Test dismiss
      await user.press(screen.getByTestId('harvest-error-banner-dismiss'));
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('should handle unauthorized error with re-auth action', async () => {
      const onReAuth = jest.fn();
      const actions: ErrorAction[] = [
        { label: 'Sign In Again', action: 're_auth', onPress: onReAuth },
      ];

      const user = userEvent.setup();
      render(
        <HarvestErrorBanner
          message="Your session has expired"
          actions={actions}
          variant="error"
        />
      );

      await user.press(
        screen.getByTestId('harvest-error-banner-action-re_auth')
      );
      expect(onReAuth).toHaveBeenCalledTimes(1);
    });
  });
});
