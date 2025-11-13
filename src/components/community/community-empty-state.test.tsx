import React from 'react';

import { cleanup, screen, setup } from '@/lib/test-utils';

import { CommunityEmptyState } from './community-empty-state';

afterEach(cleanup);

const onCreatePressMock = jest.fn();

describe('CommunityEmptyState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    test('renders correctly with default props', async () => {
      setup(<CommunityEmptyState />);
      expect(
        await screen.findByTestId('community-empty-state')
      ).toBeOnTheScreen();
    });

    test('displays educational title', async () => {
      setup(<CommunityEmptyState />);
      expect(
        await screen.findByText('Welcome to the Community')
      ).toBeOnTheScreen();
    });

    test('displays moderation guidance', async () => {
      setup(<CommunityEmptyState />);
      expect(
        await screen.findByText(
          'All posts are reviewed to ensure a safe, educational community. Avoid commerce, illegal content, or personal attacks.'
        )
      ).toBeOnTheScreen();
    });

    test('displays empty state message', async () => {
      setup(<CommunityEmptyState />);
      expect(
        await screen.findByText('No posts yet. Be the first to share!')
      ).toBeOnTheScreen();
    });

    test('renders create button when onCreatePress is provided', async () => {
      setup(<CommunityEmptyState onCreatePress={onCreatePressMock} />);
      expect(
        await screen.findByTestId('community-empty-state-create')
      ).toBeOnTheScreen();
    });

    test('button displays correct label', async () => {
      setup(<CommunityEmptyState onCreatePress={onCreatePressMock} />);
      expect(await screen.findByText('Share an Update')).toBeOnTheScreen();
    });

    test('does not render create button when onCreatePress is not provided', async () => {
      setup(<CommunityEmptyState />);
      expect(
        screen.queryByTestId('community-empty-state-create')
      ).not.toBeOnTheScreen();
    });
  });

  describe('Interactions', () => {
    test('calls onCreatePress when button is pressed', async () => {
      const { user } = setup(
        <CommunityEmptyState onCreatePress={onCreatePressMock} />
      );
      const button = await screen.findByTestId('community-empty-state-create');
      await user.press(button);
      expect(onCreatePressMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    test('button has correct accessibility role', async () => {
      setup(<CommunityEmptyState onCreatePress={onCreatePressMock} />);
      const button = await screen.findByTestId('community-empty-state-create');
      expect(button).toHaveProp('accessibilityRole', 'button');
    });

    test('button has accessibility hint', async () => {
      setup(<CommunityEmptyState onCreatePress={onCreatePressMock} />);
      const button = await screen.findByTestId('community-empty-state-create');
      expect(button).toHaveProp(
        'accessibilityHint',
        'Opens the Create Post screen.'
      );
    });
  });
});
