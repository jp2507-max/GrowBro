import React from 'react';

import { cleanup, screen, setup } from '@/lib/test-utils';

import { StrainsEmptyState } from './strains-empty-state';

afterEach(cleanup);

describe('StrainsEmptyState', () => {
  describe('Rendering with query', () => {
    test('renders no results message when query is provided', async () => {
      setup(
        <StrainsEmptyState query="test strain" showOfflineNotice={false} />
      );
      expect(
        await screen.findByTestId('strains-empty-state')
      ).toBeOnTheScreen();
      expect(await screen.findByText('No strains found')).toBeOnTheScreen();
    });

    test('shows offline notice with query', async () => {
      setup(<StrainsEmptyState query="test" showOfflineNotice={true} />);
      expect(
        await screen.findByText('Showing saved strains')
      ).toBeOnTheScreen();
    });
  });

  describe('Rendering without query (educational)', () => {
    test('renders educational empty state when no query', async () => {
      setup(<StrainsEmptyState query="" showOfflineNotice={false} />);
      expect(
        await screen.findByTestId('strains-empty-state-educational')
      ).toBeOnTheScreen();
    });

    test('displays educational title', async () => {
      setup(<StrainsEmptyState query="" showOfflineNotice={false} />);
      expect(
        await screen.findByText('Discover the Perfect Strain')
      ).toBeOnTheScreen();
    });

    test('displays all search tips', async () => {
      setup(<StrainsEmptyState query="" showOfflineNotice={false} />);
      expect(
        await screen.findByText(
          'Try searching by strain name, effects, or flavors'
        )
      ).toBeOnTheScreen();
      expect(
        await screen.findByText(
          'Use filters to narrow down by THC/CBD levels or difficulty'
        )
      ).toBeOnTheScreen();
      expect(
        await screen.findByText('Bookmark your favorites for quick access')
      ).toBeOnTheScreen();
    });

    test('shows offline banner when offline', async () => {
      setup(<StrainsEmptyState query="" showOfflineNotice={true} />);
      expect(
        await screen.findByText(
          'Saved strains are available offline for quick reference'
        )
      ).toBeOnTheScreen();
    });

    test('does not show offline banner when online', async () => {
      setup(<StrainsEmptyState query="" showOfflineNotice={false} />);
      expect(
        screen.queryByText(
          'Saved strains are available offline for quick reference'
        )
      ).not.toBeOnTheScreen();
    });
  });

  describe('Accessibility', () => {
    test('has correct accessibility role', async () => {
      setup(<StrainsEmptyState query="" showOfflineNotice={false} />);
      const emptyState = await screen.findByTestId(
        'strains-empty-state-educational'
      );
      expect(emptyState).toHaveProp('accessibilityRole', 'summary');
    });
  });
});
