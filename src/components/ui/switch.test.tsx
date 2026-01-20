import React from 'react';

import { cleanup, screen, setup } from '@/lib/test-utils';

import { Switch } from './switch';

afterEach(cleanup);

describe('Switch component', () => {
  it('renders correctly and calls onValueChange on Press', async () => {
    const mockOnValueChange = jest.fn();
    const { user } = setup(
      <Switch
        testID="switch"
        value={false}
        onValueChange={mockOnValueChange}
        accessibilityLabel="agree"
        accessibilityHint="toggle Agree"
      />
    );
    expect(screen.getByTestId('switch')).toBeOnTheScreen();
    expect(screen.getByTestId('switch')).toBeEnabled();
    // React Native Switch uses 'value' prop for checked state in tests often, or accessibilityState.checked depending on impl
    expect(screen.getByTestId('switch')).toHaveProp('value', false);

    await user.press(screen.getByTestId('switch'));
    expect(mockOnValueChange).toHaveBeenCalledTimes(1);
    expect(mockOnValueChange).toHaveBeenCalledWith(true);
  });

  it("shouldn't change value while disabled", async () => {
    const mockOnValueChange = jest.fn();
    const { user } = setup(
      <Switch
        disabled={true}
        testID="switch"
        value={false}
        onValueChange={mockOnValueChange}
        accessibilityLabel="agree"
        accessibilityHint="toggle Agree"
      />
    );
    expect(screen.getByTestId('switch')).toBeOnTheScreen();
    // Note: React Native's Switch disabled prop might not reflect in accessibilityState.disabled automatically in all test environments without explicitly setting accessibilityState
    // But we check if the user interaction triggers the callback
    await user.press(screen.getByTestId('switch'));
    expect(mockOnValueChange).toHaveBeenCalledTimes(0);
  });
});
