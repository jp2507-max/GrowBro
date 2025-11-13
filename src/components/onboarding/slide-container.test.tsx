/**
 * Tests for SlideContainer component
 */

import React from 'react';
import { Text } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import { cleanup, screen, setup } from '@/lib/test-utils';

import { SlideContainer } from './slide-container';

afterEach(cleanup);

describe('SlideContainer', () => {
  describe('Rendering', () => {
    test('renders children correctly', async () => {
      const TestComponent = () => {
        const activeIndex = useSharedValue(0);
        return (
          <SlideContainer index={0} activeIndex={activeIndex}>
            <Text testID="child-content">Test Content</Text>
          </SlideContainer>
        );
      };

      setup(<TestComponent />);

      expect(await screen.findByTestId('child-content')).toBeOnTheScreen();
    });

    test('supports custom testID', async () => {
      const TestComponent = () => {
        const activeIndex = useSharedValue(0);
        return (
          <SlideContainer
            index={0}
            activeIndex={activeIndex}
            testID="custom-slide"
          >
            <Text>Content</Text>
          </SlideContainer>
        );
      };

      setup(<TestComponent />);

      expect(await screen.findByTestId('custom-slide')).toBeOnTheScreen();
    });

    test('renders with different index values', async () => {
      const TestComponent = () => {
        const activeIndex = useSharedValue(1);
        return (
          <SlideContainer index={1} activeIndex={activeIndex}>
            <Text testID="slide-content">Slide 1</Text>
          </SlideContainer>
        );
      };

      setup(<TestComponent />);

      expect(await screen.findByTestId('slide-content')).toBeOnTheScreen();
    });

    test('renders with custom window value', async () => {
      const TestComponent = () => {
        const activeIndex = useSharedValue(0);
        return (
          <SlideContainer index={0} activeIndex={activeIndex} window={0.75}>
            <Text testID="slide-content">Content</Text>
          </SlideContainer>
        );
      };

      setup(<TestComponent />);

      expect(await screen.findByTestId('slide-content')).toBeOnTheScreen();
    });
  });
});
