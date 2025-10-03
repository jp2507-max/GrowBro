/* eslint-disable max-lines-per-function */
import React from 'react';

import { cleanup, screen, setup } from '@/lib/test-utils';

import { DidYouMean } from './did-you-mean';

afterEach(cleanup);

const onAcceptMock: jest.Mock<Parameters<typeof DidYouMean>[0]['onAccept']> =
  jest.fn();

describe('DidYouMean', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    test('renders correctly with default props', async () => {
      setup(<DidYouMean suggestion="Test Strain" onAccept={onAcceptMock} />);
      expect(await screen.findByTestId('did-you-mean')).toBeOnTheScreen();
      expect(screen.getByText('Did you mean')).toBeOnTheScreen();
      expect(screen.getByText('Test Strain')).toBeOnTheScreen();
      expect(screen.getByText('?')).toBeOnTheScreen();
    });

    test('renders correctly with custom testID', async () => {
      setup(
        <DidYouMean
          suggestion="Test Strain"
          onAccept={onAcceptMock}
          testID="custom-test-id"
        />
      );
      expect(await screen.findByTestId('custom-test-id')).toBeOnTheScreen();
      expect(screen.getByTestId('custom-test-id-suggestion')).toBeOnTheScreen();
    });

    test('displays the suggestion text correctly', async () => {
      const suggestion = 'Blue Dream';
      setup(<DidYouMean suggestion={suggestion} onAccept={onAcceptMock} />);
      expect(await screen.findByText(suggestion)).toBeOnTheScreen();
    });
  });

  describe('Interactions', () => {
    test('calls onAccept when suggestion is pressed', async () => {
      const { user } = setup(
        <DidYouMean suggestion="Test Strain" onAccept={onAcceptMock} />
      );
      const suggestionButton = screen.getByTestId('did-you-mean-suggestion');

      await user.press(suggestionButton);

      expect(onAcceptMock).toHaveBeenCalledWith('Test Strain');
      expect(onAcceptMock).toHaveBeenCalledTimes(1);
    });

    test('passes correct suggestion to onAccept callback', async () => {
      const { user } = setup(
        <DidYouMean suggestion="Gorilla Glue" onAccept={onAcceptMock} />
      );
      const suggestionButton = screen.getByTestId('did-you-mean-suggestion');

      await user.press(suggestionButton);

      expect(onAcceptMock).toHaveBeenCalledWith('Gorilla Glue');
    });
  });

  describe('Accessibility', () => {
    test('has correct accessibility properties', async () => {
      setup(<DidYouMean suggestion="Test Strain" onAccept={onAcceptMock} />);
      const suggestionButton = await screen.findByTestId(
        'did-you-mean-suggestion'
      );

      expect(suggestionButton).toHaveAccessibilityRole('button');
      expect(suggestionButton).toHaveAccessibilityLabel(
        'Did you mean Test Strain?'
      );
      expect(suggestionButton).toHaveAccessibilityHint(
        'Applies suggested search term'
      );
    });
  });
});
