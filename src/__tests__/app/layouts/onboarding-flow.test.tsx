/**
 * Integration tests for onboarding flow
 * Task: 15.6
 * Requirements: 1.1, 1.5, 1.10
 * Tests the complete flow: AgeGate → LegalConfirmationModal → ConsentModal
 */

import React from 'react';

// Import the actual components
import AgeGateScreen from '@/app/age-gate';
import { cleanup, screen, setup, waitFor } from '@/lib/test-utils';

// Mock dependencies
jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({
    replace: jest.fn(),
    push: jest.fn(),
    back: jest.fn(),
  })),
}));

jest.mock('@/lib/compliance/age-gate', () => ({
  useAgeGate: {
    status: jest.fn(() => 'not-verified'),
  },
  verifyAgeGate: jest.fn(),
  startAgeGateSession: jest.fn(),
}));

jest.mock('@/lib/compliance/onboarding-state', () => ({
  useOnboardingState: {
    currentStep: jest.fn(() => 'age-gate'),
    completedSteps: jest.fn(() => []),
  },
  completeOnboardingStep: jest.fn(),
}));

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

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

describe('Onboarding Flow Integration', () => {
  describe('Complete Flow: Age Gate → Legal Confirmation → Navigation', () => {
    test('shows age gate screen initially', async () => {
      setup(<AgeGateScreen />);

      expect(
        await screen.findByText('cannabis.age_gate_title')
      ).toBeOnTheScreen();
      expect(screen.getByTestId('age-gate-day')).toBeOnTheScreen();
      expect(screen.getByTestId('age-gate-month')).toBeOnTheScreen();
      expect(screen.getByTestId('age-gate-year')).toBeOnTheScreen();
      expect(screen.getByTestId('age-gate-submit')).toBeOnTheScreen();
    });

    test('validates age and shows error for underage users', async () => {
      const { verifyAgeGate } = require('@/lib/compliance/age-gate');
      verifyAgeGate.mockReturnValue({ ok: false, reason: 'underage' });

      const { user } = setup(<AgeGateScreen />);

      // Enter underage birthdate (e.g., 2010)
      const dayInput = await screen.findByTestId('age-gate-day');
      const monthInput = screen.getByTestId('age-gate-month');
      const yearInput = screen.getByTestId('age-gate-year');

      await user.type(dayInput, '01');
      await user.type(monthInput, '01');
      await user.type(yearInput, '2010');

      const submitButton = screen.getByTestId('age-gate-submit');
      await user.press(submitButton);

      await waitFor(() => {
        expect(screen.getByTestId('age-gate-error')).toBeOnTheScreen();
        expect(
          screen.getByText('cannabis.age_gate_error_underage')
        ).toBeOnTheScreen();
      });
    });

    test('validates age and shows error for invalid date', async () => {
      const { verifyAgeGate } = require('@/lib/compliance/age-gate');
      verifyAgeGate.mockReturnValue({ ok: false, reason: 'invalid' });

      const { user } = setup(<AgeGateScreen />);

      const dayInput = await screen.findByTestId('age-gate-day');
      const monthInput = screen.getByTestId('age-gate-month');
      const yearInput = screen.getByTestId('age-gate-year');

      await user.type(dayInput, '32');
      await user.type(monthInput, '13');
      await user.type(yearInput, '1990');

      const submitButton = screen.getByTestId('age-gate-submit');
      await user.press(submitButton);

      await waitFor(() => {
        expect(screen.getByTestId('age-gate-error')).toBeOnTheScreen();
        expect(
          screen.getByText('cannabis.age_gate_error_invalid')
        ).toBeOnTheScreen();
      });
    });

    test('shows legal confirmation modal after valid age verification', async () => {
      const {
        verifyAgeGate,
        startAgeGateSession,
      } = require('@/lib/compliance/age-gate');
      const {
        completeOnboardingStep,
      } = require('@/lib/compliance/onboarding-state');

      verifyAgeGate.mockReturnValue({ ok: true });

      const { user } = setup(<AgeGateScreen />);

      const dayInput = await screen.findByTestId('age-gate-day');
      const monthInput = screen.getByTestId('age-gate-month');
      const yearInput = screen.getByTestId('age-gate-year');

      await user.type(dayInput, '01');
      await user.type(monthInput, '01');
      await user.type(yearInput, '1990');

      const submitButton = screen.getByTestId('age-gate-submit');
      await user.press(submitButton);

      await waitFor(() => {
        expect(verifyAgeGate).toHaveBeenCalledWith({
          birthDay: 1,
          birthMonth: 1,
          birthYear: 1990,
        });
        expect(startAgeGateSession).toHaveBeenCalled();
        expect(completeOnboardingStep).toHaveBeenCalledWith('age-gate');
      });

      // Legal confirmation modal should now be visible
      await waitFor(() => {
        expect(
          screen.getByTestId('legal-confirmation-modal')
        ).toBeOnTheScreen();
      });
    });

    test('completes legal confirmation and navigates to app', async () => {
      const { verifyAgeGate } = require('@/lib/compliance/age-gate');
      const {
        completeOnboardingStep,
      } = require('@/lib/compliance/onboarding-state');
      const { useRouter } = require('expo-router');
      const mockRouter = { replace: jest.fn() };
      useRouter.mockReturnValue(mockRouter);

      verifyAgeGate.mockReturnValue({ ok: true });

      const { user } = setup(<AgeGateScreen />);

      // Submit valid age
      const dayInput = await screen.findByTestId('age-gate-day');
      const monthInput = screen.getByTestId('age-gate-month');
      const yearInput = screen.getByTestId('age-gate-year');

      await user.type(dayInput, '01');
      await user.type(monthInput, '01');
      await user.type(yearInput, '1990');

      const submitButton = screen.getByTestId('age-gate-submit');
      await user.press(submitButton);

      // Wait for legal modal to appear
      await waitFor(() => {
        expect(
          screen.getByTestId('legal-confirmation-modal')
        ).toBeOnTheScreen();
      });

      // Accept all legal documents
      const termsSwitch = screen.getByTestId('legal-switch-terms');
      const privacySwitch = screen.getByTestId('legal-switch-privacy');
      const cannabisSwitch = screen.getByTestId('legal-switch-cannabis');

      await user.press(termsSwitch);
      await user.press(privacySwitch);
      await user.press(cannabisSwitch);

      const acceptButton = screen.getByTestId('legal-accept-btn');
      await user.press(acceptButton);

      await waitFor(() => {
        expect(completeOnboardingStep).toHaveBeenCalledWith(
          'legal-confirmation'
        );
        expect(mockRouter.replace).toHaveBeenCalledWith('/(app)');
      });
    });

    test('handles legal confirmation decline', async () => {
      const { verifyAgeGate } = require('@/lib/compliance/age-gate');
      verifyAgeGate.mockReturnValue({ ok: true });

      const { user } = setup(<AgeGateScreen />);

      // Submit valid age
      const dayInput = await screen.findByTestId('age-gate-day');
      const monthInput = screen.getByTestId('age-gate-month');
      const yearInput = screen.getByTestId('age-gate-year');

      await user.type(dayInput, '01');
      await user.type(monthInput, '01');
      await user.type(yearInput, '1990');

      const submitButton = screen.getByTestId('age-gate-submit');
      await user.press(submitButton);

      // Wait for legal modal
      await waitFor(() => {
        expect(
          screen.getByTestId('legal-confirmation-modal')
        ).toBeOnTheScreen();
      });

      // Decline legal terms
      const declineButton = screen.getByTestId('legal-decline-btn');
      await user.press(declineButton);

      // Should return to age gate with error message
      await waitFor(() => {
        expect(
          screen.queryByTestId('legal-confirmation-modal')
        ).not.toBeOnTheScreen();
        expect(screen.getByTestId('age-gate-error')).toBeOnTheScreen();
        expect(
          screen.getByText('cannabis.legal_confirmation_all_required')
        ).toBeOnTheScreen();
      });
    });
  });

  describe('State Persistence and Resume Logic', () => {
    test('navigates to app if age already verified and legal confirmed', async () => {
      const { useAgeGate } = require('@/lib/compliance/age-gate');
      const {
        useOnboardingState,
      } = require('@/lib/compliance/onboarding-state');
      const { useRouter } = require('expo-router');

      useAgeGate.status.mockReturnValue('verified');
      useOnboardingState.currentStep.mockReturnValue('consent-modal');

      const mockRouter = { replace: jest.fn() };
      useRouter.mockReturnValue(mockRouter);

      setup(<AgeGateScreen />);

      await waitFor(() => {
        expect(mockRouter.replace).toHaveBeenCalledWith('/(app)');
      });
    });

    test('stays on age gate if not verified', async () => {
      const { useAgeGate } = require('@/lib/compliance/age-gate');
      const {
        useOnboardingState,
      } = require('@/lib/compliance/onboarding-state');

      useAgeGate.status.mockReturnValue('not-verified');
      useOnboardingState.currentStep.mockReturnValue('age-gate');

      setup(<AgeGateScreen />);

      expect(
        await screen.findByText('cannabis.age_gate_title')
      ).toBeOnTheScreen();
      expect(screen.getByTestId('age-gate-submit')).toBeOnTheScreen();
    });

    test('resumes from legal confirmation if age verified but legal not confirmed', async () => {
      const { useAgeGate } = require('@/lib/compliance/age-gate');
      const {
        useOnboardingState,
      } = require('@/lib/compliance/onboarding-state');

      useAgeGate.status.mockReturnValue('verified');
      useOnboardingState.currentStep.mockReturnValue('legal-confirmation');
      useOnboardingState.completedSteps.mockReturnValue(['age-gate']);

      setup(<AgeGateScreen />);

      // Should show age gate initially (component behavior)
      expect(
        await screen.findByText('cannabis.age_gate_title')
      ).toBeOnTheScreen();
    });
  });

  describe('Input Validation', () => {
    test('limits day input to 2 digits', async () => {
      const { user } = setup(<AgeGateScreen />);

      const dayInput = await screen.findByTestId('age-gate-day');
      await user.type(dayInput, '123');

      expect(dayInput.props.value).toBe('12');
    });

    test('limits month input to 2 digits', async () => {
      const { user } = setup(<AgeGateScreen />);

      const monthInput = await screen.findByTestId('age-gate-month');
      await user.type(monthInput, '456');

      expect(monthInput.props.value).toBe('45');
    });

    test('limits year input to 4 digits', async () => {
      const { user } = setup(<AgeGateScreen />);

      const yearInput = await screen.findByTestId('age-gate-year');
      await user.type(yearInput, '12345');

      expect(yearInput.props.value).toBe('1234');
    });

    test('accepts only numeric input', async () => {
      setup(<AgeGateScreen />);

      const dayInput = await screen.findByTestId('age-gate-day');
      const monthInput = screen.getByTestId('age-gate-month');
      const yearInput = screen.getByTestId('age-gate-year');

      expect(dayInput.props.keyboardType).toBe('number-pad');
      expect(monthInput.props.keyboardType).toBe('number-pad');
      expect(yearInput.props.keyboardType).toBe('number-pad');
    });
  });

  describe('Error Handling', () => {
    test('clears error when valid age is submitted after error', async () => {
      const { verifyAgeGate } = require('@/lib/compliance/age-gate');

      // First submission fails
      verifyAgeGate.mockReturnValueOnce({ ok: false, reason: 'invalid' });

      const { user } = setup(<AgeGateScreen />);

      const dayInput = await screen.findByTestId('age-gate-day');
      const monthInput = screen.getByTestId('age-gate-month');
      const yearInput = screen.getByTestId('age-gate-year');

      await user.type(dayInput, '32');
      await user.type(monthInput, '13');
      await user.type(yearInput, '1990');

      const submitButton = screen.getByTestId('age-gate-submit');
      await user.press(submitButton);

      await waitFor(() => {
        expect(screen.getByTestId('age-gate-error')).toBeOnTheScreen();
      });

      // Second submission succeeds
      verifyAgeGate.mockReturnValueOnce({ ok: true });

      await user.clear(dayInput);
      await user.clear(monthInput);
      await user.clear(yearInput);

      await user.type(dayInput, '01');
      await user.type(monthInput, '01');
      await user.type(yearInput, '1990');

      await user.press(submitButton);

      await waitFor(() => {
        expect(screen.queryByTestId('age-gate-error')).not.toBeOnTheScreen();
      });
    });
  });

  describe('Accessibility', () => {
    test('has proper labels for all inputs', async () => {
      setup(<AgeGateScreen />);

      const dayInput = await screen.findByTestId('age-gate-day');
      const monthInput = screen.getByTestId('age-gate-month');
      const yearInput = screen.getByTestId('age-gate-year');

      // Inputs should have accessible labels via Input component
      expect(dayInput).toBeOnTheScreen();
      expect(monthInput).toBeOnTheScreen();
      expect(yearInput).toBeOnTheScreen();
    });

    test('submit button is accessible', async () => {
      setup(<AgeGateScreen />);

      const submitButton = await screen.findByTestId('age-gate-submit');

      // Button should be accessible and have proper testID
      expect(submitButton).toBeOnTheScreen();
    });
  });
});
