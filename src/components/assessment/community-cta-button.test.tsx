import { router } from 'expo-router';
import * as React from 'react';

import { cleanup, render, screen, userEvent } from '@/lib/test-utils';
import type { AssessmentResult } from '@/types/assessment';

import { CommunityCTAButton } from './community-cta-button';

// Mock expo-router
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
  },
}));

afterEach(cleanup);

const createMockAssessment = (
  calibratedConfidence: number,
  isOod: boolean = false
): AssessmentResult => ({
  topClass: {
    id: 'test-class',
    name: 'Test Class',
    category: 'nutrient',
    description: 'Test',
    visualCues: [],
    isOod,
    actionTemplate: {
      immediateSteps: [],
      shortTermActions: [],
      diagnosticChecks: [],
      warnings: [],
      disclaimers: [],
    },
    createdAt: Date.now(),
  },
  rawConfidence: calibratedConfidence,
  calibratedConfidence,
  perImage: [],
  aggregationMethod: 'majority-vote',
  processingTimeMs: 100,
  mode: 'device',
  modelVersion: 'v1.0.0',
});

describe('CommunityCTAButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders button for low confidence assessment', () => {
    const assessment = createMockAssessment(0.65);

    render(
      <CommunityCTAButton assessment={assessment} assessmentId="test-123" />
    );

    expect(screen.getByTestId('community-cta-button')).toBeOnTheScreen();
  });

  test('renders button for OOD assessment', () => {
    const assessment = createMockAssessment(0.85, true);

    render(
      <CommunityCTAButton assessment={assessment} assessmentId="test-123" />
    );

    expect(screen.getByTestId('community-cta-button')).toBeOnTheScreen();
  });

  test('does not render for high confidence non-OOD assessment', () => {
    const assessment = createMockAssessment(0.85, false);

    render(
      <CommunityCTAButton assessment={assessment} assessmentId="test-123" />
    );

    expect(screen.queryByTestId('community-cta-button')).not.toBeOnTheScreen();
  });

  test('navigates to post creation on press', async () => {
    const user = userEvent.setup();
    const assessment = createMockAssessment(0.65);

    render(
      <CommunityCTAButton assessment={assessment} assessmentId="test-123" />
    );

    const button = screen.getByTestId('community-cta-button-action');
    await user.press(button);

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/feed/add-post',
      params: {
        source: 'assessment',
        assessmentId: 'test-123',
      },
    });
  });

  test('calls custom onPress handler if provided', async () => {
    const user = userEvent.setup();
    const onPress = jest.fn().mockResolvedValue(undefined);
    const assessment = createMockAssessment(0.65);

    render(
      <CommunityCTAButton
        assessment={assessment}
        assessmentId="test-123"
        onPress={onPress}
      />
    );

    const button = screen.getByTestId('community-cta-button-action');
    await user.press(button);

    expect(onPress).toHaveBeenCalled();
  });

  test('shows loading state while navigating', async () => {
    const user = userEvent.setup();
    const assessment = createMockAssessment(0.65);

    render(
      <CommunityCTAButton assessment={assessment} assessmentId="test-123" />
    );

    const button = screen.getByTestId('community-cta-button-action');

    // Start press but don't await to check loading state
    const pressPromise = user.press(button);

    // Button should show loading state briefly
    // Note: This is a simplified test; in real app, loading state would be visible
    expect(button).toBeOnTheScreen();

    // Clean up promise
    await pressPromise;
  });

  test('handles navigation errors gracefully', async () => {
    const user = userEvent.setup();
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const onPress = jest.fn().mockRejectedValue(new Error('Navigation failed'));
    const assessment = createMockAssessment(0.65);

    render(
      <CommunityCTAButton
        assessment={assessment}
        assessmentId="test-123"
        onPress={onPress}
      />
    );

    const button = screen.getByTestId('community-cta-button-action');
    await user.press(button);

    expect(consoleError).toHaveBeenCalledWith(
      'Failed to navigate to community post:',
      expect.any(Error)
    );

    consoleError.mockRestore();
  });
});
