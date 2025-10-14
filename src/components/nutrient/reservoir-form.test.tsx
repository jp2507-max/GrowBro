import React from 'react';

import { cleanup, screen, setup, waitFor } from '@/lib/test-utils';

import { ReservoirForm } from './reservoir-form';

afterEach(cleanup);

const mockOnSubmit = jest.fn();
const mockOnCancel = jest.fn();

describe('ReservoirForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Cross-field validation', () => {
    test('shows validation error when targetPhMin >= targetPhMax', async () => {
      const { user } = setup(
        <ReservoirForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          defaultValues={{
            name: 'Test Reservoir',
            volumeL: 20,
            targetPhMin: 6.5,
            targetPhMax: 6.0, // Invalid: max < min
            targetEcMin25c: 1.0,
            targetEcMax25c: 2.0,
          }}
        />
      );

      // Try to submit the form
      const submitButton = screen.getByTestId('submit-button');
      await user.press(submitButton);

      // Check that validation errors are shown
      await waitFor(() => {
        expect(
          screen.getByText('Minimum pH must be less than maximum pH')
        ).toBeOnTheScreen();
      });
      await waitFor(() => {
        expect(
          screen.getByText('Maximum pH must be greater than minimum pH')
        ).toBeOnTheScreen();
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    test('shows validation error when targetEcMin25c >= targetEcMax25c', async () => {
      const { user } = setup(
        <ReservoirForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          defaultValues={{
            name: 'Test Reservoir',
            volumeL: 20,
            targetPhMin: 5.8,
            targetPhMax: 6.2,
            targetEcMin25c: 2.5,
            targetEcMax25c: 2.0, // Invalid: max < min
          }}
        />
      );

      // Try to submit the form
      const submitButton = screen.getByTestId('submit-button');
      await user.press(submitButton);

      // Check that validation errors are shown
      await waitFor(() => {
        expect(
          screen.getByText('Minimum EC must be less than maximum EC')
        ).toBeOnTheScreen();
      });
      await waitFor(() => {
        expect(
          screen.getByText('Maximum EC must be greater than minimum EC')
        ).toBeOnTheScreen();
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    test('allows valid ranges to submit successfully', async () => {
      const { user } = setup(
        <ReservoirForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          defaultValues={{
            name: 'Test Reservoir',
            volumeL: 20,
            targetPhMin: 5.8,
            targetPhMax: 6.2,
            targetEcMin25c: 1.0,
            targetEcMax25c: 2.5,
          }}
        />
      );

      // Try to submit the form
      const submitButton = screen.getByTestId('submit-button');
      await user.press(submitButton);

      // Check that form submits successfully
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Test Reservoir',
            volumeL: 20,
            targetPhMin: 5.8,
            targetPhMax: 6.2,
            targetEcMin25c: 1.0,
            targetEcMax25c: 2.5,
          }),
          expect.anything() // Event object from button press
        );
      });
    });

    test('shows errors for both pH and EC when both ranges are invalid', async () => {
      const { user } = setup(
        <ReservoirForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          defaultValues={{
            name: 'Test Reservoir',
            volumeL: 20,
            targetPhMin: 6.5,
            targetPhMax: 6.0, // Invalid pH
            targetEcMin25c: 2.5,
            targetEcMax25c: 2.0, // Invalid EC
          }}
        />
      );

      // Try to submit the form
      const submitButton = screen.getByTestId('submit-button');
      await user.press(submitButton);

      // Check that all validation errors are shown
      await waitFor(() => {
        expect(
          screen.getByText('Minimum pH must be less than maximum pH')
        ).toBeOnTheScreen();
      });
      await waitFor(() => {
        expect(
          screen.getByText('Maximum pH must be greater than minimum pH')
        ).toBeOnTheScreen();
      });
      await waitFor(() => {
        expect(
          screen.getByText('Minimum EC must be less than maximum EC')
        ).toBeOnTheScreen();
      });
      await waitFor(() => {
        expect(
          screen.getByText('Maximum EC must be greater than minimum EC')
        ).toBeOnTheScreen();
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });
});
