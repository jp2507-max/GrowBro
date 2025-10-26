/* eslint-disable */
// @ts-nocheck
import React from 'react';

import { AssessmentFeedbackSheet, type AssessmentFeedbackSheetProps } from './assessment-feedback-sheet';
import { cleanup, screen, setup, waitFor } from '@/lib/test-utils';
afterEach(cleanup);

const onSubmitMock: jest.Mock<AssessmentFeedbackSheetProps['onSubmit']> = jest.fn();

describe('AssessmentFeedbackSheet', () => {
  // Setup section
  beforeAll(() => {
    // Global setup
  });

  beforeEach(() => {
    // Reset mocks and state
    jest.clearAllMocks();
  });

  // Test cases grouped by functionality
  describe('Rendering', () => {
    test('renders correctly with default props', async () => {
      setup(<AssessmentFeedbackSheet onSubmit={onSubmitMock} assessmentId="test-id" />);
      expect(await screen.findByText('assessment.feedback.title')).toBeOnTheScreen();
    });
  });

  describe('Interactions', () => {
    test('handles helpful response navigation', async () => {
      const { user } = setup(<AssessmentFeedbackSheet onSubmit={onSubmitMock} assessmentId="test-id" />);

      const yesButton = screen.getByTestId('feedback-helpful-yes');
      await user.press(yesButton);

      // Should navigate to resolved step
      expect(screen.getByText('assessment.feedback.resolved_question')).toBeOnTheScreen();
    });

    test('handles not helpful response navigation', async () => {
      const { user } = setup(<AssessmentFeedbackSheet onSubmit={onSubmitMock} assessmentId="test-id" />);

      const noButton = screen.getByTestId('feedback-helpful-no');
      await user.press(noButton);

      // Should navigate to notes step
      expect(screen.getByText('assessment.feedback.notes_question')).toBeOnTheScreen();
    });

    test('handles resolved response navigation', async () => {
      const { user } = setup(<AssessmentFeedbackSheet onSubmit={onSubmitMock} assessmentId="test-id" />);

      // Navigate to resolved step
      const yesButton = screen.getByTestId('feedback-helpful-yes');
      await user.press(yesButton);

      // Select resolved option
      const resolvedYesButton = screen.getByTestId('feedback-resolved-yes');
      await user.press(resolvedYesButton);

      // Should navigate to notes step
      expect(screen.getByText('assessment.feedback.notes_question')).toBeOnTheScreen();
    });

    test('handles notes input', async () => {
      const { user } = setup(<AssessmentFeedbackSheet onSubmit={onSubmitMock} assessmentId="test-id" />);

      // Navigate to notes step
      const noButton = screen.getByTestId('feedback-helpful-no');
      await user.press(noButton);

      const notesInput = screen.getByTestId('feedback-notes');
      await user.type(notesInput, 'Test feedback notes');

      expect(notesInput).toHaveDisplayValue('Test feedback notes');
    });

    test('handles submit with complete feedback', async () => {
      const { user } = setup(<AssessmentFeedbackSheet onSubmit={onSubmitMock} assessmentId="test-id" />);

      // Complete the feedback flow
      const yesButton = screen.getByTestId('feedback-helpful-yes');
      await user.press(yesButton);

      const resolvedYesButton = screen.getByTestId('feedback-resolved-yes');
      await user.press(resolvedYesButton);

      const notesInput = screen.getByTestId('feedback-notes');
      await user.type(notesInput, 'Test notes');

      const submitButton = screen.getByTestId('feedback-submit');
      await user.press(submitButton);

      // Should call onSubmit with correct data
      expect(onSubmitMock).toHaveBeenCalledWith({
        helpful: true,
        issueResolved: 'yes',
        notes: 'Test notes',
      });
    });

    test('handles skip with minimal feedback', async () => {
      const { user } = setup(<AssessmentFeedbackSheet onSubmit={onSubmitMock} assessmentId="test-id" />);

      // Navigate to notes step
      const noButton = screen.getByTestId('feedback-helpful-no');
      await user.press(noButton);

      const skipButton = screen.getByTestId('feedback-skip');
      await user.press(skipButton);

      // Should call onSubmit with minimal data
      expect(onSubmitMock).toHaveBeenCalledWith({
        helpful: false,
        issueResolved: undefined,
        notes: undefined,
      });
    });
  });

  describe('State Management', () => {
    test('resets state after submission', async () => {
      const { user } = setup(<AssessmentFeedbackSheet onSubmit={onSubmitMock} assessmentId="test-id" />);

      // Navigate through steps
      const noButton = screen.getByTestId('feedback-helpful-no');
      await user.press(noButton);

      const notesInput = screen.getByTestId('feedback-notes');
      await user.type(notesInput, 'Test notes');

      const submitButton = screen.getByTestId('feedback-submit');
      await user.press(submitButton);

      // After submission, should reset to initial state
      expect(screen.getByText('assessment.feedback.helpful_question')).toBeOnTheScreen();
    });
  });
});
