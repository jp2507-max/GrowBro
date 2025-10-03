import React from 'react';

import { RaceBadge } from '@/components/strains/race-badge';
import { cleanup, render, screen } from '@/lib/test-utils';

afterEach(cleanup);

describe('RaceBadge', () => {
  describe('Rendering', () => {
    test('renders correctly for indica strain', () => {
      render(<RaceBadge race="indica" testID="race-badge-indica" />);
      expect(screen.getByTestId('race-badge-indica')).toBeOnTheScreen();
      // Text translations are handled by i18next, so we just check the component renders
    });

    test('renders correctly for sativa strain', () => {
      render(<RaceBadge race="sativa" testID="race-badge-sativa" />);
      expect(screen.getByTestId('race-badge-sativa')).toBeOnTheScreen();
    });

    test('renders correctly for hybrid strain', () => {
      render(<RaceBadge race="hybrid" testID="race-badge-hybrid" />);
      expect(screen.getByTestId('race-badge-hybrid')).toBeOnTheScreen();
    });
  });

  describe('Accessibility', () => {
    test('has correct accessibility role', () => {
      render(<RaceBadge race="indica" testID="race-badge" />);
      const badge = screen.getByTestId('race-badge');
      expect(badge.props.accessibilityRole).toBe('text');
    });

    test('has accessibility label defined', () => {
      render(<RaceBadge race="sativa" testID="race-badge" />);
      const badge = screen.getByTestId('race-badge');
      expect(badge.props.accessibilityLabel).toBeDefined();
    });
  });
});
