import React from 'react';

import { cleanup, screen, setup } from '@/lib/test-utils';

import { CounterArgumentsInput } from './counter-arguments-input';

afterEach(cleanup);

describe('CounterArgumentsInput', () => {
  // Setup section
  beforeAll(() => {
    // Global setup
  });

  beforeEach(() => {
    // Reset mocks and state
    jest.clearAllMocks();
  });

  // Test cases grouped by functionality
  describe('Rendering', () => {
    test('renders correctly with default props', async () => {
      const mockOnChange = jest.fn();
      setup(<CounterArgumentsInput value="" onChange={mockOnChange} />);
      expect(
        await screen.findByTestId('counter-arguments-input')
      ).toBeOnTheScreen();
    });

    test('renders correctly with custom testID', async () => {
      const mockOnChange = jest.fn();
      setup(
        <CounterArgumentsInput
          value=""
          onChange={mockOnChange}
          testID="custom-test"
        />
      );
      expect(await screen.findByTestId('custom-test')).toBeOnTheScreen();
    });
  });

  describe('Character Counter', () => {
    test('displays correct character count with empty input', async () => {
      const mockOnChange = jest.fn();
      setup(<CounterArgumentsInput value="" onChange={mockOnChange} />);
      expect(
        await screen.findByTestId('counter-arguments-input-counter')
      ).toHaveTextContent('0 / 5000 characters (minimum 50)');
    });

    test('displays correct character count with input text', async () => {
      const mockOnChange = jest.fn();
      const testValue = 'This is a test input';
      setup(
        <CounterArgumentsInput value={testValue} onChange={mockOnChange} />
      );
      expect(
        await screen.findByTestId('counter-arguments-input-counter')
      ).toHaveTextContent('20 / 5000 characters (minimum 50)');
    });
  });

  describe('Interactions', () => {
    test('calls onChange when text is entered', async () => {
      const mockOnChange = jest.fn();
      const { user } = setup(
        <CounterArgumentsInput value="" onChange={mockOnChange} />
      );

      const input = screen.getByTestId('counter-arguments-input-input');
      await user.type(input, 'test input');

      expect(mockOnChange).toHaveBeenCalledWith('test input');
    });

    test('displays updated character count when typing', async () => {
      const mockOnChange = jest.fn();
      const { user } = setup(
        <CounterArgumentsInput value="" onChange={mockOnChange} />
      );

      const input = screen.getByTestId('counter-arguments-input-input');
      await user.type(input, 'hello world');

      expect(
        await screen.findByTestId('counter-arguments-input-counter')
      ).toHaveTextContent('11 / 5000 characters (minimum 50)');
    });
  });

  describe('Accessibility', () => {
    test('has correct accessibility labels', async () => {
      const mockOnChange = jest.fn();
      setup(<CounterArgumentsInput value="" onChange={mockOnChange} />);

      expect(
        await screen.findByTestId('counter-arguments-input-label')
      ).toBeOnTheScreen();
      expect(
        await screen.findByTestId('counter-arguments-input-hint')
      ).toBeOnTheScreen();
      expect(
        await screen.findByTestId('counter-arguments-input-counter')
      ).toBeOnTheScreen();
    });
  });
});
