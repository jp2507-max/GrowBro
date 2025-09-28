import React from 'react';

import { cleanup, screen, setup, waitFor } from '@/lib/test-utils';

import { Inputs } from './inputs';

afterEach(cleanup);

describe('Inputs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    test('renders correctly', async () => {
      setup(<Inputs />);
      expect(await screen.findByText('Form')).toBeOnTheScreen();
    });

    test('renders checkbox example with correct accessibility label', async () => {
      setup(<Inputs />);
      const checkbox = await screen.findByTestId('checkbox-example');
      expect(checkbox).toBeOnTheScreen();
      expect(checkbox).toHaveAccessibilityValue({ checked: false });
    });
  });

  describe('Checkbox Interactions', () => {
    test('checkbox can be toggled', async () => {
      const { user } = setup(<Inputs />);
      const checkbox = await screen.findByTestId('checkbox-example');

      // Initially unchecked
      expect(checkbox).toHaveAccessibilityValue({ checked: false });

      // Toggle on
      await user.press(checkbox);
      await waitFor(() => {
        expect(checkbox).toHaveAccessibilityValue({ checked: true });
      });

      // Toggle off
      await user.press(checkbox);
      await waitFor(() => {
        expect(checkbox).toHaveAccessibilityValue({ checked: false });
      });
    });
  });
});
