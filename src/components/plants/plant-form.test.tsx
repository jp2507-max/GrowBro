import React from 'react';

import { act, screen, setup } from '@/lib/test-utils';

import { PlantForm } from './plant-form';

// Mock the StrainPicker to avoid complex modal/icon dependencies
jest.mock('@/components/community/strain-picker', () => ({
  StrainPicker: ({
    value,
    onSelectFull,
    label,
    testID,
  }: {
    value?: string;
    onSelectFull?: jest.Mock;
    label?: string;
    testID?: string;
  }) => {
    const { Pressable, Text, View } = require('react-native');
    return (
      <View testID={testID}>
        {label && <Text>{label}</Text>}
        <Pressable
          accessibilityRole="button"
          testID={`${testID}-trigger`}
          onPress={() => {
            // Simulate selection of a mock strain with full structure
            onSelectFull?.(
              {
                id: 'mock-id',
                name: 'Mock Strain',
                slug: 'mock-strain',
                race: 'hybrid',
                synonyms: [],
                link: '',
                imageUrl: '',
                description: [],
                genetics: { parents: [], lineage: '' },
                thc: {},
                cbd: {},
                effects: [],
                flavors: [],
                terpenes: undefined,
                grow: {
                  difficulty: 'beginner',
                  indoor_suitable: true,
                  outdoor_suitable: true,
                  flowering_time: { label: '' },
                  yield: { indoor: { label: '' }, outdoor: { label: '' } },
                  height: { label: '' },
                },
                source: {
                  provider: 'api',
                  updated_at: new Date().toISOString(),
                  attribution_url: '',
                },
                thc_display: '',
                cbd_display: '',
              },
              'api'
            );
          }}
        >
          <Text>{value || 'Select strain'}</Text>
        </Pressable>
      </View>
    );
  },
}));

describe('PlantForm', () => {
  test('renders and submits form successfully', async () => {
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

    // Tap strain picker to select a strain
    const strainTrigger = screen.getByTestId('plant-strain-picker-trigger');
    await user.press(strainTrigger);

    await act(async () => {
      submitHandler?.();
    });

    expect(onSubmit).toHaveBeenCalled();
  });
});
