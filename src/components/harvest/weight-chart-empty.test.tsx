/**
 * WeightChartEmpty Component Tests
 *
 * Requirements: 4.5
 */

import React from 'react';

import { cleanup, render, screen, setup } from '@/lib/test-utils';

import { WeightChartEmpty } from './weight-chart-empty';

afterEach(cleanup);

describe('WeightChartEmpty', () => {
  describe('Rendering', () => {
    it('should render with no-data variant (Requirement 4.5)', () => {
      render(<WeightChartEmpty variant="no-data" />);

      expect(screen.getByTestId('weight-chart-empty')).toBeOnTheScreen();
      expect(screen.getByText('No Harvest Data Yet')).toBeOnTheScreen();
      expect(
        screen.getByText(
          'Start your first harvest to see weight progression over time.'
        )
      ).toBeOnTheScreen();
    });

    it('should render with filtered variant (Requirement 4.5)', () => {
      render(<WeightChartEmpty variant="filtered" />);

      expect(screen.getByTestId('weight-chart-empty')).toBeOnTheScreen();
      expect(screen.getByText('No Data Found')).toBeOnTheScreen();
      expect(
        screen.getByText('Try adjusting your filters to see harvest data.')
      ).toBeOnTheScreen();
    });
  });

  describe('CTA Button', () => {
    it('should render create button when onCreatePress is provided', async () => {
      const onCreatePress = jest.fn();
      const { user } = setup(
        <WeightChartEmpty variant="no-data" onCreatePress={onCreatePress} />
      );

      const button = screen.getByTestId('create-harvest-button');
      expect(button).toBeOnTheScreen();
      expect(screen.getByText('Create First Harvest')).toBeOnTheScreen();

      await user.press(button);
      expect(onCreatePress).toHaveBeenCalledTimes(1);
    });

    it('should not render button when onCreatePress is not provided', () => {
      render(<WeightChartEmpty variant="no-data" />);

      expect(
        screen.queryByTestId('create-harvest-button')
      ).not.toBeOnTheScreen();
    });

    it('should not render button for filtered variant', () => {
      const onCreatePress = jest.fn();
      render(
        <WeightChartEmpty variant="filtered" onCreatePress={onCreatePress} />
      );

      expect(
        screen.queryByTestId('create-harvest-button')
      ).not.toBeOnTheScreen();
    });
  });

  describe('Accessibility', () => {
    it('should have testID for testing', () => {
      render(<WeightChartEmpty variant="no-data" testID="custom-empty" />);

      expect(screen.getByTestId('custom-empty')).toBeOnTheScreen();
    });

    it('should have accessible content', () => {
      render(<WeightChartEmpty variant="no-data" />);

      // Text should be readable by screen readers
      expect(screen.getByText('No Harvest Data Yet')).toBeOnTheScreen();
    });
  });
});
