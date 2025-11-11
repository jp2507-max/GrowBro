/**
 * Unit tests for LegalConfirmationModal component
 * Task: 15.2
 * Requirements: 1.5, 1.6
 */

import React from 'react';

import { cleanup, screen, setup, waitFor } from '@/lib/test-utils';
import type { LegalConfirmationModalProps } from '@/types/settings';

import { LegalConfirmationModal } from './legal-confirmation-modal';

// Mock dependencies
jest.mock('@/lib/compliance/legal-acceptances', () => ({
  acceptAllLegalDocuments: jest.fn(),
  getCurrentLegalVersions: jest.fn(() => ({
    terms: { version: '1.0.0', effectiveDate: '2025-01-01' },
    privacy: { version: '1.0.0', effectiveDate: '2025-01-01' },
    cannabis: { version: '1.0.0', effectiveDate: '2025-01-01' },
  })),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('@/lib/i18n', () => ({
  translate: (key: string) => key,
}));

afterEach(cleanup);

const mockOnAccept = jest.fn();
const mockOnDecline = jest.fn();

const defaultProps: LegalConfirmationModalProps = {
  isVisible: true,
  onAccept: mockOnAccept,
  onDecline: mockOnDecline,
};

describe('LegalConfirmationModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    test('renders correctly when visible', async () => {
      setup(<LegalConfirmationModal {...defaultProps} />);

      expect(
        await screen.findByTestId('legal-confirmation-modal')
      ).toBeOnTheScreen();
      expect(
        screen.getByText('cannabis.legal_confirmation_title')
      ).toBeOnTheScreen();
      expect(
        screen.getByText('cannabis.legal_confirmation_subtitle')
      ).toBeOnTheScreen();
    });

    test('does not render when not visible', () => {
      setup(<LegalConfirmationModal {...defaultProps} isVisible={false} />);

      expect(
        screen.queryByTestId('legal-confirmation-modal')
      ).not.toBeOnTheScreen();
    });

    test('renders all three legal document sections', async () => {
      setup(<LegalConfirmationModal {...defaultProps} />);

      expect(
        await screen.findByTestId('legal-section-terms')
      ).toBeOnTheScreen();
      expect(screen.getByTestId('legal-section-privacy')).toBeOnTheScreen();
      expect(screen.getByTestId('legal-section-cannabis')).toBeOnTheScreen();
    });

    test('displays correct labels for each section', async () => {
      setup(<LegalConfirmationModal {...defaultProps} />);

      expect(
        await screen.findByText('cannabis.legal_confirmation_terms_label')
      ).toBeOnTheScreen();
      expect(
        screen.getByText('cannabis.legal_confirmation_privacy_label')
      ).toBeOnTheScreen();
      expect(
        screen.getByText('cannabis.legal_confirmation_cannabis_label')
      ).toBeOnTheScreen();
    });

    test('displays summaries for each section', async () => {
      setup(<LegalConfirmationModal {...defaultProps} />);

      expect(
        await screen.findByText('cannabis.legal_confirmation_terms_summary')
      ).toBeOnTheScreen();
      expect(
        screen.getByText('cannabis.legal_confirmation_privacy_summary')
      ).toBeOnTheScreen();
      expect(
        screen.getByText('cannabis.legal_confirmation_cannabis_summary')
      ).toBeOnTheScreen();
    });

    test('renders accept and decline buttons', async () => {
      setup(<LegalConfirmationModal {...defaultProps} />);

      expect(await screen.findByTestId('legal-accept-btn')).toBeOnTheScreen();
      expect(screen.getByTestId('legal-decline-btn')).toBeOnTheScreen();
    });
  });

  describe('Switch Logic', () => {
    test('all switches start unchecked', async () => {
      setup(<LegalConfirmationModal {...defaultProps} />);

      const termsSwitch = await screen.findByTestId('legal-switch-terms');
      const privacySwitch = screen.getByTestId('legal-switch-privacy');
      const cannabisSwitch = screen.getByTestId('legal-switch-cannabis');

      expect(termsSwitch.props.accessibilityState.checked).toBe(false);
      expect(privacySwitch.props.accessibilityState.checked).toBe(false);
      expect(cannabisSwitch.props.accessibilityState.checked).toBe(false);
    });

    test('can toggle terms of service switch', async () => {
      const { user } = setup(<LegalConfirmationModal {...defaultProps} />);

      const termsSwitch = await screen.findByTestId('legal-switch-terms');
      expect(termsSwitch.props.accessibilityState.checked).toBe(false);

      await user.press(termsSwitch);

      await waitFor(() => {
        expect(termsSwitch.props.accessibilityState.checked).toBe(true);
      });
    });

    test('can toggle privacy policy switch', async () => {
      const { user } = setup(<LegalConfirmationModal {...defaultProps} />);

      const privacySwitch = await screen.findByTestId('legal-switch-privacy');
      expect(privacySwitch.props.accessibilityState.checked).toBe(false);

      await user.press(privacySwitch);

      await waitFor(() => {
        expect(privacySwitch.props.accessibilityState.checked).toBe(true);
      });
    });

    test('can toggle cannabis policy switch', async () => {
      const { user } = setup(<LegalConfirmationModal {...defaultProps} />);

      const cannabisSwitch = await screen.findByTestId('legal-switch-cannabis');
      expect(cannabisSwitch.props.accessibilityState.checked).toBe(false);

      await user.press(cannabisSwitch);

      await waitFor(() => {
        expect(cannabisSwitch.props.accessibilityState.checked).toBe(true);
      });
    });

    test('can toggle all switches independently', async () => {
      const { user } = setup(<LegalConfirmationModal {...defaultProps} />);

      const termsSwitch = await screen.findByTestId('legal-switch-terms');
      const privacySwitch = screen.getByTestId('legal-switch-privacy');
      const cannabisSwitch = screen.getByTestId('legal-switch-cannabis');

      await user.press(termsSwitch);
      await user.press(cannabisSwitch);

      await waitFor(() => {
        expect(termsSwitch.props.accessibilityState.checked).toBe(true);
        expect(privacySwitch.props.accessibilityState.checked).toBe(false);
        expect(cannabisSwitch.props.accessibilityState.checked).toBe(true);
      });
    });

    test('can turn switches off after turning them on', async () => {
      const { user } = setup(<LegalConfirmationModal {...defaultProps} />);

      const termsSwitch = await screen.findByTestId('legal-switch-terms');

      await user.press(termsSwitch);
      await waitFor(() => {
        expect(termsSwitch.props.accessibilityState.checked).toBe(true);
      });

      await user.press(termsSwitch);
      await waitFor(() => {
        expect(termsSwitch.props.accessibilityState.checked).toBe(false);
      });
    });
  });

  describe('Button Disabled State', () => {
    test('accept button is disabled when no switches are checked', async () => {
      setup(<LegalConfirmationModal {...defaultProps} />);

      const acceptButton = await screen.findByTestId('legal-accept-btn');
      expect(acceptButton.props.accessibilityState.disabled).toBe(true);
    });

    test('accept button is disabled when only one switch is checked', async () => {
      const { user } = setup(<LegalConfirmationModal {...defaultProps} />);

      const termsSwitch = await screen.findByTestId('legal-switch-terms');
      await user.press(termsSwitch);

      const acceptButton = screen.getByTestId('legal-accept-btn');
      await waitFor(() => {
        expect(acceptButton.props.accessibilityState.disabled).toBe(true);
      });
    });

    test('accept button is disabled when only two switches are checked', async () => {
      const { user } = setup(<LegalConfirmationModal {...defaultProps} />);

      const termsSwitch = await screen.findByTestId('legal-switch-terms');
      const privacySwitch = await screen.findByTestId('legal-switch-privacy');

      await user.press(termsSwitch);
      await user.press(privacySwitch);

      const acceptButton = screen.getByTestId('legal-accept-btn');
      await waitFor(() => {
        expect(acceptButton.props.accessibilityState.disabled).toBe(true);
      });
    });

    test('accept button is enabled when all switches are checked', async () => {
      const { user } = setup(<LegalConfirmationModal {...defaultProps} />);

      const termsSwitch = await screen.findByTestId('legal-switch-terms');
      const privacySwitch = await screen.findByTestId('legal-switch-privacy');
      const cannabisSwitch = await screen.findByTestId('legal-switch-cannabis');

      await user.press(termsSwitch);
      await user.press(privacySwitch);
      await user.press(cannabisSwitch);

      const acceptButton = screen.getByTestId('legal-accept-btn');
      await waitFor(() => {
        expect(acceptButton.props.accessibilityState.disabled).toBe(false);
      });
    });

    test('shows warning message when accept button is disabled', async () => {
      setup(<LegalConfirmationModal {...defaultProps} />);

      expect(
        await screen.findByTestId('legal-all-required-message')
      ).toBeOnTheScreen();
      expect(
        screen.getByText('cannabis.legal_confirmation_all_required')
      ).toBeOnTheScreen();
    });

    test('hides warning message when all switches are checked', async () => {
      const { user } = setup(<LegalConfirmationModal {...defaultProps} />);

      const termsSwitch = await screen.findByTestId('legal-switch-terms');
      const privacySwitch = await screen.findByTestId('legal-switch-privacy');
      const cannabisSwitch = await screen.findByTestId('legal-switch-cannabis');

      await user.press(termsSwitch);
      await user.press(privacySwitch);
      await user.press(cannabisSwitch);

      await waitFor(() => {
        expect(
          screen.queryByTestId('legal-all-required-message')
        ).not.toBeOnTheScreen();
      });
    });

    test('decline button is always enabled', async () => {
      setup(<LegalConfirmationModal {...defaultProps} />);

      const declineButton = await screen.findByTestId('legal-decline-btn');
      expect(declineButton.props.accessibilityState?.disabled).not.toBe(true);
    });
  });

  describe('Acceptance Flow', () => {
    test('calls acceptAllLegalDocuments when accept button is pressed', async () => {
      const {
        acceptAllLegalDocuments,
      } = require('@/lib/compliance/legal-acceptances');
      const { user } = setup(<LegalConfirmationModal {...defaultProps} />);

      const termsSwitch = await screen.findByTestId('legal-switch-terms');
      const privacySwitch = await screen.findByTestId('legal-switch-privacy');
      const cannabisSwitch = await screen.findByTestId('legal-switch-cannabis');

      await user.press(termsSwitch);
      await user.press(privacySwitch);
      await user.press(cannabisSwitch);

      const acceptButton = screen.getByTestId('legal-accept-btn');
      await user.press(acceptButton);

      await waitFor(() => {
        expect(acceptAllLegalDocuments).toHaveBeenCalledWith({
          terms: '1.0.0',
          privacy: '1.0.0',
          cannabis: '1.0.0',
        });
      });
    });

    test('calls onAccept callback with acceptances when accept is pressed', async () => {
      const { user } = setup(<LegalConfirmationModal {...defaultProps} />);

      const termsSwitch = await screen.findByTestId('legal-switch-terms');
      const privacySwitch = await screen.findByTestId('legal-switch-privacy');
      const cannabisSwitch = await screen.findByTestId('legal-switch-cannabis');

      await user.press(termsSwitch);
      await user.press(privacySwitch);
      await user.press(cannabisSwitch);

      const acceptButton = screen.getByTestId('legal-accept-btn');
      await user.press(acceptButton);

      await waitFor(() => {
        expect(mockOnAccept).toHaveBeenCalledWith({
          termsOfService: true,
          privacyPolicy: true,
          cannabisPolicy: true,
        });
      });
    });

    test('does not call onAccept when accept button is disabled', async () => {
      const { user } = setup(<LegalConfirmationModal {...defaultProps} />);

      const acceptButton = await screen.findByTestId('legal-accept-btn');
      await user.press(acceptButton);

      expect(mockOnAccept).not.toHaveBeenCalled();
    });

    test('calls onDecline when decline button is pressed', async () => {
      const { user } = setup(<LegalConfirmationModal {...defaultProps} />);

      const declineButton = await screen.findByTestId('legal-decline-btn');
      await user.press(declineButton);

      await waitFor(() => {
        expect(mockOnDecline).toHaveBeenCalledTimes(1);
      });
    });

    test('uses current legal versions when accepting', async () => {
      const {
        getCurrentLegalVersions,
      } = require('@/lib/compliance/legal-acceptances');
      getCurrentLegalVersions.mockReturnValue({
        terms: { version: '2.1.0', effectiveDate: '2025-06-01' },
        privacy: { version: '1.5.0', effectiveDate: '2025-05-01' },
        cannabis: { version: '1.2.0', effectiveDate: '2025-04-01' },
      });

      const {
        acceptAllLegalDocuments,
      } = require('@/lib/compliance/legal-acceptances');
      const { user } = setup(<LegalConfirmationModal {...defaultProps} />);

      const termsSwitch = await screen.findByTestId('legal-switch-terms');
      const privacySwitch = await screen.findByTestId('legal-switch-privacy');
      const cannabisSwitch = await screen.findByTestId('legal-switch-cannabis');

      await user.press(termsSwitch);
      await user.press(privacySwitch);
      await user.press(cannabisSwitch);

      const acceptButton = screen.getByTestId('legal-accept-btn');
      await user.press(acceptButton);

      await waitFor(() => {
        expect(acceptAllLegalDocuments).toHaveBeenCalledWith({
          terms: '2.1.0',
          privacy: '1.5.0',
          cannabis: '1.2.0',
        });
      });
    });
  });

  describe('Accessibility', () => {
    test('all switches have accessibility labels', async () => {
      setup(<LegalConfirmationModal {...defaultProps} />);

      const termsSwitch = await screen.findByTestId('legal-switch-terms');
      const privacySwitch = screen.getByTestId('legal-switch-privacy');
      const cannabisSwitch = screen.getByTestId('legal-switch-cannabis');

      expect(termsSwitch.props.accessibilityLabel).toBe(
        'cannabis.legal_confirmation_terms_label'
      );
      expect(privacySwitch.props.accessibilityLabel).toBe(
        'cannabis.legal_confirmation_privacy_label'
      );
      expect(cannabisSwitch.props.accessibilityLabel).toBe(
        'cannabis.legal_confirmation_cannabis_label'
      );
    });

    test('all switches have accessibility hints', async () => {
      setup(<LegalConfirmationModal {...defaultProps} />);

      const termsSwitch = await screen.findByTestId('legal-switch-terms');
      const privacySwitch = screen.getByTestId('legal-switch-privacy');
      const cannabisSwitch = screen.getByTestId('legal-switch-cannabis');

      expect(termsSwitch.props.accessibilityHint).toBe(
        'accessibility.common.toggleHint'
      );
      expect(privacySwitch.props.accessibilityHint).toBe(
        'accessibility.common.toggleHint'
      );
      expect(cannabisSwitch.props.accessibilityHint).toBe(
        'accessibility.common.toggleHint'
      );
    });

    test('accept button reflects disabled state in accessibility', async () => {
      setup(<LegalConfirmationModal {...defaultProps} />);

      const acceptButton = await screen.findByTestId('legal-accept-btn');
      expect(acceptButton.props.accessibilityState.disabled).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    test('handles rapid switch toggling correctly', async () => {
      const { user } = setup(<LegalConfirmationModal {...defaultProps} />);

      const termsSwitch = await screen.findByTestId('legal-switch-terms');

      await user.press(termsSwitch);
      await user.press(termsSwitch);
      await user.press(termsSwitch);

      await waitFor(() => {
        expect(termsSwitch.props.accessibilityState.checked).toBe(true);
      });
    });

    test('maintains state when toggling between sections', async () => {
      const { user } = setup(<LegalConfirmationModal {...defaultProps} />);

      const termsSwitch = await screen.findByTestId('legal-switch-terms');
      const privacySwitch = await screen.findByTestId('legal-switch-privacy');

      await user.press(termsSwitch);
      await user.press(privacySwitch);
      await user.press(termsSwitch); // Turn off terms

      await waitFor(() => {
        expect(termsSwitch.props.accessibilityState.checked).toBe(false);
        expect(privacySwitch.props.accessibilityState.checked).toBe(true);
      });
    });

    test('does not break when getCurrentLegalVersions throws error', async () => {
      const {
        getCurrentLegalVersions,
      } = require('@/lib/compliance/legal-acceptances');
      getCurrentLegalVersions.mockImplementation(() => {
        throw new Error('Network error');
      });

      // Should not crash
      expect(() => {
        setup(<LegalConfirmationModal {...defaultProps} />);
      }).not.toThrow();
    });
  });
});
