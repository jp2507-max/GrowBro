import React from 'react';

import { cleanup, screen, setup, waitFor } from '@/lib/test-utils';

import { PhEcReadingForm } from './ph-ec-reading-form';

type PhEcReadingFormProps = React.ComponentProps<typeof PhEcReadingForm>;

const onSubmitMock: jest.MockedFunction<PhEcReadingFormProps['onSubmit']> =
  jest.fn();

afterEach(cleanup);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('PhEcReadingForm', () => {
  test('displays EC@25°C and ppm conversion when ATC is off', async () => {
    const { user } = setup(
      <PhEcReadingForm
        onSubmit={onSubmitMock}
        reservoirs={[]}
        defaultValues={{ atcOn: false }}
      />
    );

    await user.type(screen.getByTestId('ec-raw-input'), '2.0');
    await user.type(screen.getByTestId('temp-input'), '22.0');

    await waitFor(() => {
      expect(screen.getByText('EC@25°C: 2.13 mS/cm')).toBeOnTheScreen();
    });

    expect(screen.getByText('1064 ppm [500]')).toBeOnTheScreen();
  });

  test('skips double temperature compensation when ATC is enabled', async () => {
    const { user } = setup(
      <PhEcReadingForm onSubmit={onSubmitMock} reservoirs={[]} />
    );

    await user.type(screen.getByTestId('ec-raw-input'), '2.0');
    await user.type(screen.getByTestId('temp-input'), '22.0');

    await waitFor(() => {
      expect(screen.getByText('EC@25°C: 2.13 mS/cm')).toBeOnTheScreen();
    });

    await user.press(screen.getByTestId('atc-toggle'));

    await waitFor(() => {
      expect(screen.getByText('EC@25°C: 2.00 mS/cm')).toBeOnTheScreen();
    });
  });

  test('shows quality flags for high temperature without ATC', async () => {
    const { user } = setup(
      <PhEcReadingForm onSubmit={onSubmitMock} reservoirs={[]} />
    );

    await user.type(screen.getByTestId('ec-raw-input'), '1.5');
    await user.type(screen.getByTestId('temp-input'), '30.0');

    await waitFor(() => {
      expect(screen.getByText('⚠️ Quality Flags')).toBeOnTheScreen();
    });

    expect(
      screen.getByText('• Manual temperature compensation applied')
    ).toBeOnTheScreen();
    expect(
      screen.getByText('• Temperature ≥28°C may affect accuracy')
    ).toBeOnTheScreen();
  });
});
