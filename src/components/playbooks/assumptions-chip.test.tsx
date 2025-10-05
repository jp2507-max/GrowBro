import React from 'react';

import { cleanup, screen, setup } from '@/lib/test-utils';

import { AssumptionsChip } from './assumptions-chip';

afterEach(cleanup);

describe('AssumptionsChip - Rendering', () => {
  test('renders nothing when usedDefaults is false', async () => {
    const assumptions = {
      usedDefaults: false,
      message: 'Using breeder data',
    };

    setup(<AssumptionsChip assumptions={assumptions} />);

    expect(screen.queryByTestId('assumptions-chip')).not.toBeOnTheScreen();
  });

  test('renders chip when usedDefaults is true', async () => {
    const assumptions = {
      usedDefaults: true,
      assumedStrainType: 'photoperiod' as const,
      message: 'Using conservative photoperiod defaults',
    };

    setup(<AssumptionsChip assumptions={assumptions} />);

    expect(await screen.findByTestId('assumptions-chip')).toBeOnTheScreen();
    expect(screen.getByText('Using Defaults')).toBeOnTheScreen();
    expect(
      screen.getByText('Using conservative photoperiod defaults')
    ).toBeOnTheScreen();
  });

  test('displays warning emoji', async () => {
    const assumptions = {
      usedDefaults: true,
      message: 'Using defaults',
    };

    setup(<AssumptionsChip assumptions={assumptions} />);

    expect(screen.getByText('⚠️')).toBeOnTheScreen();
  });
});

describe('AssumptionsChip - Interactions', () => {
  test('calls onPress when chip is tapped', async () => {
    const onPressMock = jest.fn();
    const assumptions = {
      usedDefaults: true,
      message: 'Using defaults',
    };

    const { user } = setup(
      <AssumptionsChip assumptions={assumptions} onPress={onPressMock} />
    );

    const chip = await screen.findByTestId('assumptions-chip');
    await user.press(chip);

    expect(onPressMock).toHaveBeenCalledTimes(1);
  });

  test('shows info icon when onPress is provided', async () => {
    const assumptions = {
      usedDefaults: true,
      message: 'Using defaults',
    };

    setup(<AssumptionsChip assumptions={assumptions} onPress={() => {}} />);

    expect(screen.getByText('ℹ️')).toBeOnTheScreen();
  });

  test('does not show info icon when onPress is not provided', async () => {
    const assumptions = {
      usedDefaults: true,
      message: 'Using defaults',
    };

    setup(<AssumptionsChip assumptions={assumptions} />);

    expect(screen.queryByText('ℹ️')).not.toBeOnTheScreen();
  });
});

describe('AssumptionsChip - Accessibility', () => {
  test('has correct accessibility role when pressable', async () => {
    const assumptions = {
      usedDefaults: true,
      message: 'Using defaults',
    };

    setup(<AssumptionsChip assumptions={assumptions} onPress={() => {}} />);

    const chip = await screen.findByTestId('assumptions-chip');
    expect(chip.props.accessibilityRole).toBe('button');
  });

  test('has correct accessibility role when not pressable', async () => {
    const assumptions = {
      usedDefaults: true,
      message: 'Using defaults',
    };

    setup(<AssumptionsChip assumptions={assumptions} />);

    const chip = await screen.findByTestId('assumptions-chip');
    expect(chip.props.accessibilityRole).toBe('text');
  });

  test('has accessibility label', async () => {
    const assumptions = {
      usedDefaults: true,
      message: 'Using defaults',
    };

    setup(<AssumptionsChip assumptions={assumptions} />);

    const chip = await screen.findByTestId('assumptions-chip');
    expect(chip.props.accessibilityLabel).toBe(
      'Using default timing assumptions'
    );
  });
});

describe('AssumptionsChip - Custom testID', () => {
  test('accepts custom testID', async () => {
    const assumptions = {
      usedDefaults: true,
      message: 'Using defaults',
    };

    setup(
      <AssumptionsChip assumptions={assumptions} testID="custom-assumptions" />
    );

    expect(await screen.findByTestId('custom-assumptions')).toBeOnTheScreen();
  });
});
