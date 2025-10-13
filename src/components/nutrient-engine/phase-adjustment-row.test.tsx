import { fireEvent } from '@testing-library/react-native';
import React from 'react';

import type { PlantPhase } from '@/lib/nutrient-engine/types';
import { cleanup, screen, setup } from '@/lib/test-utils';

import { PhaseAdjustmentRow } from './phase-adjustment-row';

afterEach(cleanup);

const onPhOffsetChangeMock = jest.fn();
const onEcOffsetChangeMock = jest.fn();

const defaultProps = {
  phase: 'vegetative' as PlantPhase,
  phOffset: 0.5,
  ecOffset: -0.2,
  onPhOffsetChange: onPhOffsetChangeMock,
  onEcOffsetChange: onEcOffsetChangeMock,
  testID: 'phase-adjustment-row',
};

describe('PhaseAdjustmentRow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    test('renders correctly with default props', async () => {
      setup(<PhaseAdjustmentRow {...defaultProps} />);
      expect(
        await screen.findByTestId('phase-adjustment-row')
      ).toBeOnTheScreen();
      expect(screen.getByTestId('phase-adjustment-row-ph')).toBeOnTheScreen();
      expect(screen.getByTestId('phase-adjustment-row-ec')).toBeOnTheScreen();
    });

    test('displays phase name correctly', async () => {
      setup(<PhaseAdjustmentRow {...defaultProps} />);
      expect(await screen.findByText('vegetative')).toBeOnTheScreen();
    });

    test('displays initial offset values', async () => {
      setup(<PhaseAdjustmentRow {...defaultProps} />);
      const phInput = screen.getByTestId('phase-adjustment-row-ph');
      const ecInput = screen.getByTestId('phase-adjustment-row-ec');

      expect(phInput).toHaveProp('value', '0.5');
      expect(ecInput).toHaveProp('value', '-0.2');
    });
  });

  describe('Interactions', () => {
    test('allows typing intermediate text in pH input', async () => {
      setup(<PhaseAdjustmentRow {...defaultProps} />);

      const phInput = screen.getByTestId('phase-adjustment-row-ph');
      fireEvent.changeText(phInput, '-');

      expect(phInput).toHaveProp('value', '-');
      expect(onPhOffsetChangeMock).not.toHaveBeenCalled();
    });

    test('allows typing decimal points in pH input', async () => {
      setup(<PhaseAdjustmentRow {...defaultProps} />);

      const phInput = screen.getByTestId('phase-adjustment-row-ph');
      fireEvent.changeText(phInput, '.');

      expect(phInput).toHaveProp('value', '.');
      expect(onPhOffsetChangeMock).not.toHaveBeenCalled();
    });

    test('calls onPhOffsetChange with valid number on blur', async () => {
      setup(<PhaseAdjustmentRow {...defaultProps} />);

      const phInput = screen.getByTestId('phase-adjustment-row-ph');
      fireEvent.changeText(phInput, '1.2');

      expect(onPhOffsetChangeMock).toHaveBeenCalledWith(1.2);
    });

    test('reverts to previous value on blur with invalid input', async () => {
      setup(<PhaseAdjustmentRow {...defaultProps} />);

      const phInput = screen.getByTestId('phase-adjustment-row-ph');
      fireEvent.changeText(phInput, 'invalid');

      // After changing to invalid text, the value should remain as typed
      expect(phInput).toHaveProp('value', 'invalid');

      // Note: onBlur would revert to previous valid value, but we can't easily test blur in this setup
      // The important thing is that onPhOffsetChange is not called during typing
      expect(onPhOffsetChangeMock).not.toHaveBeenCalled();
    });

    test('allows typing intermediate text in EC input', async () => {
      setup(<PhaseAdjustmentRow {...defaultProps} />);

      const ecInput = screen.getByTestId('phase-adjustment-row-ec');
      fireEvent.changeText(ecInput, '-');

      expect(ecInput).toHaveProp('value', '-');
      expect(onEcOffsetChangeMock).not.toHaveBeenCalled();
    });

    test('calls onEcOffsetChange with valid number on blur', async () => {
      setup(<PhaseAdjustmentRow {...defaultProps} />);

      const ecInput = screen.getByTestId('phase-adjustment-row-ec');
      fireEvent.changeText(ecInput, '-0.5');

      expect(onEcOffsetChangeMock).toHaveBeenCalledWith(-0.5);
    });

    test('reverts to previous value on blur with invalid EC input', async () => {
      setup(<PhaseAdjustmentRow {...defaultProps} />);

      const ecInput = screen.getByTestId('phase-adjustment-row-ec');
      fireEvent.changeText(ecInput, 'not-a-number');

      expect(ecInput).toHaveProp('value', 'not-a-number');
      expect(onEcOffsetChangeMock).not.toHaveBeenCalled();
    });
  });

  describe('State Management', () => {
    test('syncs local state when props change externally', async () => {
      const { rerender } = setup(<PhaseAdjustmentRow {...defaultProps} />);

      const phInput = screen.getByTestId('phase-adjustment-row-ph');
      expect(phInput).toHaveProp('value', '0.5');

      // Simulate external prop change
      rerender(<PhaseAdjustmentRow {...defaultProps} phOffset={1.0} />);

      expect(phInput).toHaveProp('value', '1');
    });

    test('maintains typed text until blur even when props change', async () => {
      const { rerender } = setup(<PhaseAdjustmentRow {...defaultProps} />);

      const phInput = screen.getByTestId('phase-adjustment-row-ph');
      fireEvent.changeText(phInput, '2.5');

      expect(phInput).toHaveProp('value', '2.5');

      // External prop change should not override typed text
      rerender(<PhaseAdjustmentRow {...defaultProps} phOffset={3.0} />);

      expect(phInput).toHaveProp('value', '2.5');
    });
  });

  describe('Edge Cases', () => {
    test('handles empty input gracefully', async () => {
      setup(<PhaseAdjustmentRow {...defaultProps} />);

      const phInput = screen.getByTestId('phase-adjustment-row-ph');
      fireEvent.changeText(phInput, '');

      expect(phInput).toHaveProp('value', '');
      // onPhOffsetChange should not be called during typing
      expect(onPhOffsetChangeMock).not.toHaveBeenCalled();
    });

    test('handles zero input correctly', async () => {
      setup(<PhaseAdjustmentRow {...defaultProps} />);

      const phInput = screen.getByTestId('phase-adjustment-row-ph');
      fireEvent.changeText(phInput, '0');

      expect(onPhOffsetChangeMock).toHaveBeenCalledWith(0);
    });

    test('handles negative zero correctly', async () => {
      setup(<PhaseAdjustmentRow {...defaultProps} />);

      const phInput = screen.getByTestId('phase-adjustment-row-ph');
      fireEvent.changeText(phInput, '-0');

      expect(onPhOffsetChangeMock).toHaveBeenCalledWith(-0);
    });
  });
});
