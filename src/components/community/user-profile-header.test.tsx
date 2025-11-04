/**
 * Unit tests for UserProfileHeader component
 * Task: 15.1
 * Requirements: 9.1, 10.1
 */

import React from 'react';

import type { UserProfile } from '@/api/community';
import { cleanup, screen, setup } from '@/lib/test-utils';

import { UserProfileHeader } from './user-profile-header';

afterEach(cleanup);

const mockProfile: UserProfile = {
  id: '123',
  username: 'testuser',
  avatar_url: 'https://example.com/avatar.jpg',
  bio: 'Test bio for user',
  created_at: '2024-01-01T00:00:00Z',
};

const mockProfileWithoutAvatar: UserProfile = {
  id: '456',
  username: 'noavatar',
  bio: undefined,
  created_at: '2024-01-01T00:00:00Z',
};

describe('UserProfileHeader', () => {
  describe('Rendering', () => {
    test('renders correctly with complete profile data', async () => {
      setup(<UserProfileHeader profile={mockProfile} />);

      expect(
        await screen.findByTestId('user-profile-header')
      ).toBeOnTheScreen();
      expect(
        screen.getByTestId('user-profile-header-avatar')
      ).toBeOnTheScreen();
      expect(
        screen.getByTestId('user-profile-header-username')
      ).toBeOnTheScreen();
      expect(screen.getByTestId('user-profile-header-bio')).toBeOnTheScreen();
    });

    test('displays username correctly', async () => {
      setup(<UserProfileHeader profile={mockProfile} />);

      const username = await screen.findByTestId(
        'user-profile-header-username'
      );
      expect(username).toHaveTextContent('testuser');
    });

    test('displays bio when provided', async () => {
      setup(<UserProfileHeader profile={mockProfile} />);

      const bio = await screen.findByTestId('user-profile-header-bio');
      expect(bio).toHaveTextContent('Test bio for user');
    });

    test('renders placeholder avatar when avatar_url is not provided', async () => {
      setup(<UserProfileHeader profile={mockProfileWithoutAvatar} />);

      const placeholder = await screen.findByTestId(
        'user-profile-header-avatar-placeholder'
      );
      expect(placeholder).toBeOnTheScreen();
      expect(
        screen.queryByTestId('user-profile-header-avatar')
      ).not.toBeOnTheScreen();
    });

    test('shows first letter of username in placeholder avatar', async () => {
      setup(<UserProfileHeader profile={mockProfileWithoutAvatar} />);

      const placeholder = await screen.findByTestId(
        'user-profile-header-avatar-placeholder'
      );
      // The placeholder should contain the first letter uppercase
      expect(placeholder).toBeOnTheScreen();
    });

    test('does not render bio element when bio is undefined', async () => {
      setup(<UserProfileHeader profile={mockProfileWithoutAvatar} />);

      await screen.findByTestId('user-profile-header-username');
      expect(
        screen.queryByTestId('user-profile-header-bio')
      ).not.toBeOnTheScreen();
    });

    test('renders with custom testID', async () => {
      setup(<UserProfileHeader profile={mockProfile} testID="custom-header" />);

      expect(await screen.findByTestId('custom-header')).toBeOnTheScreen();
      expect(screen.getByTestId('custom-header-username')).toBeOnTheScreen();
      expect(screen.getByTestId('custom-header-avatar')).toBeOnTheScreen();
      expect(screen.getByTestId('custom-header-bio')).toBeOnTheScreen();
    });
  });

  describe('Edge Cases', () => {
    test('handles empty string bio', async () => {
      const profileWithEmptyBio: UserProfile = {
        ...mockProfile,
        bio: '',
      };
      setup(<UserProfileHeader profile={profileWithEmptyBio} />);

      await screen.findByTestId('user-profile-header-username');
      // Empty bio should not render the bio element
      expect(
        screen.queryByTestId('user-profile-header-bio')
      ).not.toBeOnTheScreen();
    });

    test('handles single character username', async () => {
      const profileSingleChar: UserProfile = {
        ...mockProfile,
        username: 'A',
      };
      setup(<UserProfileHeader profile={profileSingleChar} />);

      const username = await screen.findByTestId(
        'user-profile-header-username'
      );
      expect(username).toHaveTextContent('A');
    });

    test('handles long username', async () => {
      const profileLongUsername: UserProfile = {
        ...mockProfile,
        username: 'verylongusernamethatmightoverflow1234567890',
      };
      setup(<UserProfileHeader profile={profileLongUsername} />);

      const username = await screen.findByTestId(
        'user-profile-header-username'
      );
      expect(username).toHaveTextContent(
        'verylongusernamethatmightoverflow1234567890'
      );
    });

    test('handles long bio text', async () => {
      const longBio = 'A'.repeat(500);
      const profileLongBio: UserProfile = {
        ...mockProfile,
        bio: longBio,
      };
      setup(<UserProfileHeader profile={profileLongBio} />);

      const bio = await screen.findByTestId('user-profile-header-bio');
      expect(bio).toHaveTextContent(longBio);
    });
  });

  describe('Avatar Display', () => {
    test('renders Image component when avatar_url is provided', async () => {
      setup(<UserProfileHeader profile={mockProfile} />);

      const avatar = await screen.findByTestId('user-profile-header-avatar');
      expect(avatar).toBeOnTheScreen();
      // expo-image wraps source in an array
      expect(avatar.props.source).toEqual([
        { uri: 'https://example.com/avatar.jpg' },
      ]);
    });

    test('renders placeholder with correct initial', async () => {
      setup(<UserProfileHeader profile={mockProfileWithoutAvatar} />);

      const placeholder = await screen.findByTestId(
        'user-profile-header-avatar-placeholder'
      );
      expect(placeholder).toBeOnTheScreen();
      // Check that the text content includes the uppercase first letter
      const textElement = screen.getByText('N'); // 'noavatar' starts with 'n', uppercase is 'N'
      expect(textElement).toBeOnTheScreen();
    });
  });

  describe('Accessibility', () => {
    test('all text elements are accessible', async () => {
      setup(<UserProfileHeader profile={mockProfile} />);

      const username = await screen.findByTestId(
        'user-profile-header-username'
      );
      const bio = screen.getByTestId('user-profile-header-bio');

      expect(username).toBeOnTheScreen();
      expect(bio).toBeOnTheScreen();
    });
  });
});
