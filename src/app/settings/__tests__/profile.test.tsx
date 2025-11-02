import React from 'react';

import { screen, setup, waitFor } from '@/lib/test-utils';

// SUT
import ProfileScreen from '../profile';

// Mocks
const mockRouter = { push: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
}));

const mockUser = { id: 'test-user-id' };
jest.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: mockUser }),
}));

jest.mock('@/lib/hooks/use-profile-statistics', () => ({
  useProfileStatistics: () => ({
    plantsCount: 5,
    harvestsCount: 2,
    postsCount: 10,
    likesReceived: 25,
    isLoading: false,
    isSyncing: false,
    refresh: jest.fn(),
  }),
}));

jest.mock('@/lib/sync/profile-sync', () => ({
  fetchProfileFromBackend: jest.fn(),
  syncProfileToBackend: jest.fn(),
}));

jest.mock('@/lib/compliance/profanity-filter', () => ({
  checkProfanity: jest.fn().mockReturnValue({ isProfane: false }),
}));

jest.mock('@/components/settings/avatar-picker', () => ({
  AvatarPicker: ({ onPress }: { onPress: () => void }) => (
    <div data-testid="avatar-picker" onClick={onPress} />
  ),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'profile.loading': 'Loading profile...',
      };
      return translations[key] || key;
    },
  }),
}));

describe('ProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders without crashing', async () => {
    const { fetchProfileFromBackend } = require('@/lib/sync/profile-sync');
    fetchProfileFromBackend.mockResolvedValue(null);

    setup(<ProfileScreen />);

    // Component should render without crashing - check for any element
    expect(screen.getByText('Loading profile...')).toBeOnTheScreen();
  });

  test('shows loading state initially', async () => {
    const { fetchProfileFromBackend } = require('@/lib/sync/profile-sync');
    fetchProfileFromBackend.mockResolvedValue(null);

    setup(<ProfileScreen />);

    // Wait for the loading text to appear
    await waitFor(() => {
      expect(screen.getByText('Loading profile...')).toBeOnTheScreen();
    });
  });
});
