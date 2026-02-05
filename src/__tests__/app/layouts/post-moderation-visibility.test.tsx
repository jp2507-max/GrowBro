import React from 'react';

import Post from '@/app/(app)/(index,community,strains,calendar)/feed/[id]';
import { cleanup, screen, setup } from '@/lib/test-utils';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: '1' }),
  Stack: { Screen: () => null },
}));

jest.mock('@/api', () => ({
  usePost: () => ({
    data: { id: 1, userId: 2, title: 'Hello', body: 'World' },
    isPending: false,
    isError: false,
  }),
}));

afterEach(cleanup);

test('post screen shows moderation actions', async () => {
  setup(<Post />);
  expect(await screen.findByTestId('moderation-actions')).toBeOnTheScreen();
});
