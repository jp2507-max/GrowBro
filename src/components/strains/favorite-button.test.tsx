import React from 'react';

import { FavoriteButton } from '@/components/strains/favorite-button';
import { cleanup, render, screen, setup } from '@/lib/test-utils';

afterEach(cleanup);

const mockOnToggle = jest.fn();

describe('FavoriteButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    test('renders correctly when not favorited', () => {
      render(
        <FavoriteButton
          isFavorite={false}
          onToggle={mockOnToggle}
          testID="favorite-button"
        />
      );
      expect(screen.getByTestId('favorite-button')).toBeOnTheScreen();
    });

    test('renders correctly when favorited', () => {
      render(
        <FavoriteButton
          isFavorite={true}
          onToggle={mockOnToggle}
          testID="favorite-button"
        />
      );
      expect(screen.getByTestId('favorite-button')).toBeOnTheScreen();
    });
  });

  describe('Interactions', () => {
    test('calls onToggle when pressed', async () => {
      const { user } = setup(
        <FavoriteButton
          isFavorite={false}
          onToggle={mockOnToggle}
          testID="favorite-button"
        />
      );

      const button = screen.getByTestId('favorite-button');
      await user.press(button);

      expect(mockOnToggle).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    test('has correct accessibility role', () => {
      render(
        <FavoriteButton
          isFavorite={false}
          onToggle={mockOnToggle}
          testID="favorite-button"
        />
      );
      const button = screen.getByTestId('favorite-button');
      expect(button.props.accessibilityRole).toBe('switch');
    });

    test('has correct accessibility state when not favorited', () => {
      render(
        <FavoriteButton
          isFavorite={false}
          onToggle={mockOnToggle}
          testID="favorite-button"
        />
      );
      const button = screen.getByTestId('favorite-button');
      expect(button.props.accessibilityState).toEqual({ checked: false });
    });

    test('has correct accessibility state when favorited', () => {
      render(
        <FavoriteButton
          isFavorite={true}
          onToggle={mockOnToggle}
          testID="favorite-button"
        />
      );
      const button = screen.getByTestId('favorite-button');
      expect(button.props.accessibilityState).toEqual({ checked: true });
    });

    test('uses custom accessibility label when provided', () => {
      render(
        <FavoriteButton
          isFavorite={false}
          onToggle={mockOnToggle}
          accessibilityLabel="Custom label"
          accessibilityHint="Custom hint"
          testID="favorite-button"
        />
      );
      const button = screen.getByTestId('favorite-button');
      expect(button.props.accessibilityLabel).toBe('Custom label');
    });

    test('uses default accessibility label when not provided', () => {
      render(
        <FavoriteButton
          isFavorite={false}
          onToggle={mockOnToggle}
          testID="favorite-button"
        />
      );
      const button = screen.getByTestId('favorite-button');
      expect(button.props.accessibilityLabel).toBe('Add to favorites');
    });
  });
});
