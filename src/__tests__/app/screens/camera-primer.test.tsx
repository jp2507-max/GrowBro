import React from 'react';

import CameraPrimerScreen from '@/app/camera-primer';
import { useIsFirstTime } from '@/lib/hooks';
import { cleanup, screen, setup } from '@/lib/test-utils';

afterEach(cleanup);

// Mock the hooks and router
jest.mock('@/lib/hooks', () => ({
  useIsFirstTime: jest.fn(),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn() }),
}));

const mockUseIsFirstTime = useIsFirstTime as jest.MockedFunction<
  typeof useIsFirstTime
>;

describe('CameraPrimerScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders correctly', async () => {
    mockUseIsFirstTime.mockReturnValue([true, jest.fn()]);
    setup(<CameraPrimerScreen />);
    expect(await screen.findByTestId('camera-primer-screen')).toBeOnTheScreen();
  });

  test('uses useIsFirstTime hook', () => {
    const mockSetIsFirstTime = jest.fn();
    mockUseIsFirstTime.mockReturnValue([true, mockSetIsFirstTime]);

    setup(<CameraPrimerScreen />);

    // Verify the hook was called
    expect(mockUseIsFirstTime).toHaveBeenCalled();
  });
});
