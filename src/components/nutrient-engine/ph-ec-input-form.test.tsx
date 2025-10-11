/**
 * pH/EC Input Form Tests
 *
 * Requirements: 2.2, 2.7, 2.8
 */

import React from 'react';

import { PpmScale } from '@/lib/nutrient-engine/types';
import { cleanup, render, screen, userEvent, waitFor } from '@/lib/test-utils';

import { PhEcInputForm } from './ph-ec-input-form';

afterEach(cleanup);

describe('PhEcInputForm', () => {
  const mockOnSubmit = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    test('renders all required fields', async () => {
      render(<PhEcInputForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      expect(
        await screen.findByTestId('ph-ec-input-form-ph')
      ).toBeOnTheScreen();
      expect(
        await screen.findByTestId('ph-ec-input-form-ec-raw')
      ).toBeOnTheScreen();
      expect(
        await screen.findByTestId('ph-ec-input-form-temp')
      ).toBeOnTheScreen();
      expect(
        await screen.findByTestId('ph-ec-input-form-atc-toggle')
      ).toBeOnTheScreen();
      expect(
        await screen.findByTestId('ph-ec-input-form-ppm-scale')
      ).toBeOnTheScreen();
    });

    test('renders action buttons', async () => {
      render(<PhEcInputForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      expect(
        await screen.findByTestId('ph-ec-input-form-cancel')
      ).toBeOnTheScreen();
      expect(
        await screen.findByTestId('ph-ec-input-form-submit')
      ).toBeOnTheScreen();
    });
  });

  describe('Input Validation', () => {
    test('validates pH range', async () => {
      const user = userEvent.setup();
      render(<PhEcInputForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      const phInput = await screen.findByTestId('ph-ec-input-form-ph');
      await user.type(phInput, '15');

      // Form should be invalid
      const submitButton = await screen.findByTestId('ph-ec-input-form-submit');
      expect(submitButton).toBeDisabled();
    });

    test('validates EC range', async () => {
      const user = userEvent.setup();
      render(<PhEcInputForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      const ecInput = await screen.findByTestId('ph-ec-input-form-ec-raw');
      await user.type(ecInput, '15');

      const submitButton = await screen.findByTestId('ph-ec-input-form-submit');
      expect(submitButton).toBeDisabled();
    });

    test('validates temperature range', async () => {
      const user = userEvent.setup();
      render(<PhEcInputForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      const tempInput = await screen.findByTestId('ph-ec-input-form-temp');
      await user.type(tempInput, '50');

      const submitButton = await screen.findByTestId('ph-ec-input-form-submit');
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Computed Values', () => {
    test('displays EC@25°C when values are valid', async () => {
      const user = userEvent.setup();
      render(<PhEcInputForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      await user.type(await screen.findByTestId('ph-ec-input-form-ph'), '6.5');
      await user.type(
        await screen.findByTestId('ph-ec-input-form-ec-raw'),
        '2.0'
      );
      await user.type(await screen.findByTestId('ph-ec-input-form-temp'), '22');

      // Should show computed values
      expect(screen.getByText(/mS\/cm @25°C/)).toBeOnTheScreen();
      expect(screen.getByText(/ppm \[500\]/)).toBeOnTheScreen();
    });

    test('displays quality flags when applicable', async () => {
      const user = userEvent.setup();
      render(<PhEcInputForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      // Enter values that trigger quality flags
      await user.type(await screen.findByTestId('ph-ec-input-form-ph'), '6.5');
      await user.type(
        await screen.findByTestId('ph-ec-input-form-ec-raw'),
        '2.0'
      );
      await user.type(await screen.findByTestId('ph-ec-input-form-temp'), '29'); // > 28°C

      // Should show quality badge
      expect(
        await screen.findByTestId('ph-ec-input-form-quality')
      ).toBeOnTheScreen();
    });

    test('displays confidence indicator', async () => {
      const user = userEvent.setup();
      render(<PhEcInputForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      await user.type(await screen.findByTestId('ph-ec-input-form-ph'), '6.5');
      await user.type(
        await screen.findByTestId('ph-ec-input-form-ec-raw'),
        '2.0'
      );
      await user.type(await screen.findByTestId('ph-ec-input-form-temp'), '22');

      expect(
        await screen.findByTestId('ph-ec-input-form-confidence')
      ).toBeOnTheScreen();
    });
  });

  describe('ATC Toggle', () => {
    test('toggles ATC state', async () => {
      const user = userEvent.setup();
      render(<PhEcInputForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      const atcToggle = await screen.findByTestId(
        'ph-ec-input-form-atc-toggle'
      );
      await user.press(atcToggle);

      // Button text should change
      expect(atcToggle).toHaveTextContent(/yes/i);
    });
  });

  describe('Form Submission', () => {
    test('submits form with valid data', async () => {
      const user = userEvent.setup();
      render(
        <PhEcInputForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          plantId="plant-123"
        />
      );

      await user.type(await screen.findByTestId('ph-ec-input-form-ph'), '6.5');
      await user.type(
        await screen.findByTestId('ph-ec-input-form-ec-raw'),
        '2.0'
      );
      await user.type(await screen.findByTestId('ph-ec-input-form-temp'), '22');

      const submitButton = await screen.findByTestId('ph-ec-input-form-submit');
      await user.press(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            ph: 6.5,
            ecRaw: 2.0,
            tempC: 22,
            atcOn: false,
            ppmScale: PpmScale.PPM_500,
            plantId: 'plant-123',
            ec25c: expect.any(Number),
          })
        );
      });
    });

    test('calls onCancel when cancel button pressed', async () => {
      const user = userEvent.setup();
      render(<PhEcInputForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      const cancelButton = await screen.findByTestId('ph-ec-input-form-cancel');
      await user.press(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });
  });
});
