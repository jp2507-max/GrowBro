import React from 'react';

import { cleanup, screen, setup } from '@/lib/test-utils';

import PlantsScreen from '../plants';

afterEach(cleanup);

describe('PlantsScreen', () => {
  describe('Rendering', () => {
    test('renders correctly with default props', async () => {
      setup(<PlantsScreen />);
      expect(await screen.findByTestId('plants-screen')).toBeOnTheScreen();
    });

    test('renders search input', async () => {
      setup(<PlantsScreen />);
      expect(
        await screen.findByTestId('plants-search-input')
      ).toBeOnTheScreen();
    });

    test('renders header title', async () => {
      setup(<PlantsScreen />);
      const title = await screen.findByText('Plant inventory');
      expect(title).toBeOnTheScreen();
    });
  });

  describe('Empty States', () => {
    test('renders empty state when no plants', async () => {
      setup(<PlantsScreen />);
      expect(await screen.findByTestId('plants-empty-state')).toBeOnTheScreen();
    });
  });
});
