/**
 * Tests for PaginationDots component
 */

import React from 'react';
import { useSharedValue } from 'react-native-reanimated';

import { cleanup, screen, setup } from '@/lib/test-utils';

import { PaginationDots } from './pagination-dots';

afterEach(cleanup);

describe('PaginationDots', () => {
  describe('Rendering', () => {
    test('renders correct number of dots', async () => {
      const TestComponent = () => {
        const activeIndex = useSharedValue(0);
        return <PaginationDots count={3} activeIndex={activeIndex} />;
      };

      setup(<TestComponent />);

      expect(await screen.findByTestId('pagination-dots')).toBeOnTheScreen();
      expect(await screen.findByTestId('pagination-dot-0')).toBeOnTheScreen();
      expect(await screen.findByTestId('pagination-dot-1')).toBeOnTheScreen();
      expect(await screen.findByTestId('pagination-dot-2')).toBeOnTheScreen();
    });

    test('supports custom testID', async () => {
      const TestComponent = () => {
        const activeIndex = useSharedValue(0);
        return (
          <PaginationDots
            count={3}
            activeIndex={activeIndex}
            testID="custom-dots"
          />
        );
      };

      setup(<TestComponent />);

      expect(await screen.findByTestId('custom-dots')).toBeOnTheScreen();
    });

    test('handles zero count', async () => {
      const TestComponent = () => {
        const activeIndex = useSharedValue(0);
        return <PaginationDots count={0} activeIndex={activeIndex} />;
      };

      setup(<TestComponent />);

      expect(await screen.findByTestId('pagination-dots')).toBeOnTheScreen();
    });

    test('handles large count', async () => {
      const TestComponent = () => {
        const activeIndex = useSharedValue(0);
        return <PaginationDots count={10} activeIndex={activeIndex} />;
      };

      setup(<TestComponent />);

      expect(await screen.findByTestId('pagination-dots')).toBeOnTheScreen();
      expect(await screen.findByTestId('pagination-dot-0')).toBeOnTheScreen();
      expect(await screen.findByTestId('pagination-dot-9')).toBeOnTheScreen();
    });
  });
});
