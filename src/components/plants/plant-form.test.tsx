import React from 'react';

import { useStrainsInfinite } from '@/api';
import { act, screen, setup } from '@/lib/test-utils';

import { PlantForm } from './plant-form';

jest.mock('@/api', () => ({
  useStrainsInfinite: jest.fn().mockReturnValue({
    data: { pages: [] },
    isFetching: false,
    isLoading: false,
  }),
}));

const mockUseStrainsInfinite = useStrainsInfinite as jest.Mock;

describe('PlantForm', () => {
  beforeEach(() => {
    mockUseStrainsInfinite.mockClear();
  });

  test('requires strain when submitting', async () => {
    const onSubmit = jest.fn();
    let submitHandler: (() => void) | undefined;

    const { user } = setup(
      <PlantForm
        onSubmit={onSubmit}
        onSubmitReady={(handler) => {
          submitHandler = handler;
        }}
      />
    );

    const nameInput = screen.getByTestId('plant-name-input');
    await user.type(nameInput, 'My Plant');

    await act(async () => {
      submitHandler?.();
    });

    expect(await screen.findByText('Strain is required')).toBeOnTheScreen();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
