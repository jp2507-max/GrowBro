import React from 'react';

import { cleanup, screen, setup } from '@/lib/test-utils';

import { CalendarEmptyState } from './calendar-empty-state';

afterEach(cleanup);

const onConvertToTaskMock = jest.fn();

describe('CalendarEmptyState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    test('renders correctly with default props', async () => {
      setup(<CalendarEmptyState />);
      expect(
        await screen.findByTestId('calendar-empty-state')
      ).toBeOnTheScreen();
    });

    test('displays title text', async () => {
      setup(<CalendarEmptyState />);
      expect(
        await screen.findByText('Start Your Grow Schedule')
      ).toBeOnTheScreen();
    });

    test('displays sample task title', async () => {
      setup(<CalendarEmptyState />);
      expect(
        await screen.findByText('💧 Water plants - Every 2 days')
      ).toBeOnTheScreen();
    });

    test('displays sample task description', async () => {
      setup(<CalendarEmptyState />);
      expect(
        await screen.findByText(
          'This is an example recurring task. Tap below to create your own tasks and build your grow schedule.'
        )
      ).toBeOnTheScreen();
    });

    test('renders convert button when onConvertToTask is provided', async () => {
      setup(<CalendarEmptyState onConvertToTask={onConvertToTaskMock} />);
      expect(
        await screen.findByTestId('calendar-empty-state-convert')
      ).toBeOnTheScreen();
    });

    test('does not render convert button when onConvertToTask is not provided', async () => {
      setup(<CalendarEmptyState />);
      expect(
        screen.queryByTestId('calendar-empty-state-convert')
      ).not.toBeOnTheScreen();
    });
  });

  describe('Interactions', () => {
    test('calls onConvertToTask when button is pressed', async () => {
      const { user } = setup(
        <CalendarEmptyState onConvertToTask={onConvertToTaskMock} />
      );
      const button = await screen.findByTestId('calendar-empty-state-convert');
      await user.press(button);
      expect(onConvertToTaskMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    test('button has correct accessibility role', async () => {
      setup(<CalendarEmptyState onConvertToTask={onConvertToTaskMock} />);
      const button = await screen.findByTestId('calendar-empty-state-convert');
      expect(button).toHaveProp('accessibilityRole', 'button');
    });

    test('button has accessibility hint', async () => {
      setup(<CalendarEmptyState onConvertToTask={onConvertToTaskMock} />);
      const button = await screen.findByTestId('calendar-empty-state-convert');
      expect(button).toHaveProp(
        'accessibilityHint',
        'This is an example recurring task. Tap below to create your own tasks and build your grow schedule.'
      );
    });
  });
});
