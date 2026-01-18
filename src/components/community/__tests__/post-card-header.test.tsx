import { render, screen } from '@testing-library/react-native';
import React from 'react';

import { PostCardHeader } from '../post-card-header';

// Mock the translate function
jest.mock('@/lib/i18n', () => ({
  translate: jest.fn((key) => key),
}));

describe('PostCardHeader Accessibility', () => {
  const defaultProps = {
    displayUsername: 'TestUser',
    relativeTime: '2 hours ago',
    onAuthorPress: jest.fn(),
    isOwnPost: false,
    onOptionsPress: jest.fn(),
    deletePending: false,
    moreIconColor: '#000',
    testID: 'test-post',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Verified Badge Accessibility', () => {
    test('should have accessibility props when verified', () => {
      render(<PostCardHeader {...defaultProps} isVerified={true} />);

      const verifiedBadge = screen.getByLabelText(
        'accessibility.community.verified_author'
      );
      expect(verifiedBadge).toBeTruthy();
    });

    test('should not render verified badge when not verified', () => {
      render(<PostCardHeader {...defaultProps} isVerified={false} />);

      expect(() => {
        screen.getByLabelText('accessibility.community.verified_author');
      }).toThrow();
    });
  });

  describe('Username Display', () => {
    test('should display username without unnecessary wrapper', () => {
      render(<PostCardHeader {...defaultProps} isVerified={false} />);

      const usernameElement = screen.getByText('TestUser');
      expect(usernameElement).toBeTruthy();
    });
  });
});
