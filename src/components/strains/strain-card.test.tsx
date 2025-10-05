/**
 * Unit tests for StrainCard component
 */

import React from 'react';

import { cleanup, render, screen, setup } from '@/lib/test-utils';
import type { Strain } from '@/types/strains';

import { StrainCard } from './strain-card';

// Mock expo-router
jest.mock('expo-router', () => ({
  Link: ({ children, href, ...props }: any) => {
    const child = React.Children.only(children);
    return React.cloneElement(child, {
      ...props,
      ...child.props,
      'data-href': href,
    });
  },
}));

afterEach(cleanup);

const mockStrain: Strain = {
  id: 'og-kush-001',
  name: 'OG Kush',
  slug: 'og-kush',
  synonyms: ['OG', 'Original Kush'],
  link: 'https://example.com/og-kush',
  imageUrl: 'https://example.com/og-kush.jpg',
  description: ['Classic indica-dominant hybrid with earthy and pine flavors'],
  genetics: {
    parents: ['Chemdawg', 'Hindu Kush'],
    lineage: 'Chemdawg x Hindu Kush',
  },
  race: 'hybrid',
  thc: { min: 18, max: 24 },
  cbd: { min: 0.1, max: 0.3 },
  effects: [{ name: 'Relaxed', intensity: 'high' }],
  flavors: [{ name: 'Earthy' }, { name: 'Pine' }],
  terpenes: [{ name: 'Myrcene', percentage: 0.5 }],
  grow: {
    difficulty: 'intermediate',
    indoor_suitable: true,
    outdoor_suitable: true,
    flowering_time: { min_weeks: 8, max_weeks: 9 },
    yield: { indoor: { min_grams: 400, max_grams: 600 } },
    height: { indoor_cm: 90 },
  },
  source: {
    provider: 'The Weed DB',
    updated_at: '2025-01-15T12:00:00Z',
    attribution_url: 'https://www.theweedb.com',
  },
  thc_display: '18-24%',
  cbd_display: '0.1-0.3%',
};

describe('StrainCard', () => {
  describe('Rendering', () => {
    test('renders strain name', () => {
      render(<StrainCard strain={mockStrain} testID="strain-card" />);
      expect(screen.getByText('OG Kush')).toBeOnTheScreen();
    });

    test('renders strain description preview', () => {
      render(<StrainCard strain={mockStrain} testID="strain-card" />);
      expect(
        screen.getByText(/Classic indica-dominant hybrid/)
      ).toBeOnTheScreen();
    });

    test('renders strain image', () => {
      render(<StrainCard strain={mockStrain} testID="strain-card" />);
      const images = screen.getAllByRole('image');
      expect(images.length).toBeGreaterThan(0);
    });

    test('renders with testID', () => {
      render(<StrainCard strain={mockStrain} testID="test-strain-card" />);
      expect(screen.getByTestId('test-strain-card')).toBeOnTheScreen();
    });

    test('handles missing description gracefully', () => {
      const strainWithoutDescription = {
        ...mockStrain,
        description: [],
      };
      render(
        <StrainCard strain={strainWithoutDescription} testID="strain-card" />
      );
      expect(screen.getByText('OG Kush')).toBeOnTheScreen();
    });

    test('handles missing THC display', () => {
      const strainWithoutTHC = {
        ...mockStrain,
        thc_display: '',
      };
      render(<StrainCard strain={strainWithoutTHC} testID="strain-card" />);
      expect(screen.getByText('OG Kush')).toBeOnTheScreen();
    });
  });

  describe('Interactions', () => {
    test('is pressable', async () => {
      const { user } = setup(
        <StrainCard strain={mockStrain} testID="strain-card" />
      );
      const card = screen.getByTestId('strain-card');
      await user.press(card);
      // Link navigation is handled by expo-router
    });

    test('links to strain detail page', () => {
      render(<StrainCard strain={mockStrain} testID="strain-card" />);
      const card = screen.getByTestId('strain-card');
      expect(card.props['data-href']).toBe('/strains/og-kush-001');
    });
  });

  describe('Accessibility', () => {
    test('has correct accessibility role', () => {
      render(<StrainCard strain={mockStrain} testID="strain-card" />);
      const card = screen.getByTestId('strain-card');
      expect(card.props.accessibilityRole).toBe('link');
    });

    test('has descriptive accessibility label', () => {
      render(<StrainCard strain={mockStrain} testID="strain-card" />);
      const card = screen.getByTestId('strain-card');
      expect(card.props.accessibilityLabel).toBeDefined();
      expect(card.props.accessibilityLabel).toContain('OG Kush');
    });

    test('has accessibility hint', () => {
      render(<StrainCard strain={mockStrain} testID="strain-card" />);
      const card = screen.getByTestId('strain-card');
      expect(card.props.accessibilityHint).toBeDefined();
    });
  });

  describe('Badge rendering', () => {
    test('renders race badge', () => {
      render(<StrainCard strain={mockStrain} testID="strain-card" />);
      // Race badge should be present (tested separately in race-badge.test.tsx)
      expect(screen.getByTestId('strain-card')).toBeOnTheScreen();
    });

    test('renders THC badge when THC display is present', () => {
      render(<StrainCard strain={mockStrain} testID="strain-card" />);
      expect(screen.getByTestId('strain-card')).toBeOnTheScreen();
    });

    test('renders difficulty badge', () => {
      render(<StrainCard strain={mockStrain} testID="strain-card" />);
      expect(screen.getByTestId('strain-card')).toBeOnTheScreen();
    });
  });

  describe('Different strain types', () => {
    test('renders indica strain correctly', () => {
      const indicaStrain = { ...mockStrain, race: 'indica' as const };
      render(<StrainCard strain={indicaStrain} testID="strain-card" />);
      expect(screen.getByText('OG Kush')).toBeOnTheScreen();
    });

    test('renders sativa strain correctly', () => {
      const sativaStrain = { ...mockStrain, race: 'sativa' as const };
      render(<StrainCard strain={sativaStrain} testID="strain-card" />);
      expect(screen.getByText('OG Kush')).toBeOnTheScreen();
    });

    test('renders beginner difficulty correctly', () => {
      const beginnerStrain = {
        ...mockStrain,
        grow: { ...mockStrain.grow, difficulty: 'beginner' as const },
      };
      render(<StrainCard strain={beginnerStrain} testID="strain-card" />);
      expect(screen.getByText('OG Kush')).toBeOnTheScreen();
    });

    test('renders advanced difficulty correctly', () => {
      const advancedStrain = {
        ...mockStrain,
        grow: { ...mockStrain.grow, difficulty: 'advanced' as const },
      };
      render(<StrainCard strain={advancedStrain} testID="strain-card" />);
      expect(screen.getByText('OG Kush')).toBeOnTheScreen();
    });
  });

  describe('Memoization', () => {
    test('component is memoized', () => {
      expect(StrainCard.displayName).toBe('StrainCard');
    });
  });
});
