import React from 'react';

import { useStrainsInfiniteWithCache } from '@/api/strains/use-strains-infinite-with-cache';
import { act, screen, setup } from '@/lib/test-utils';

import { PlantForm } from './plant-form';

jest.mock('@/api/strains/use-strains-infinite-with-cache', () => ({
  useStrainsInfiniteWithCache: jest.fn().mockReturnValue({
    data: { pages: [] },
    isFetching: false,
    isLoading: false,
  }),
}));

const mockUseStrainsInfiniteWithCache =
  useStrainsInfiniteWithCache as jest.Mock;

describe('PlantForm', () => {
  beforeEach(() => {
    mockUseStrainsInfiniteWithCache.mockClear();
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

    expect(
      await screen.findByTestId('plant-strain-input-error')
    ).toHaveTextContent('Required');
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
