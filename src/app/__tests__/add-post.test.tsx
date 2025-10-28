import React from 'react';

import AddPost from '@/app/feed/add-post';
import { generateCommunityPostPrefill } from '@/lib/assessment/community-post-prefill';
import {
  type AssessmentSession,
  getAssessmentSession,
} from '@/lib/assessment/current-assessment-store';
import { cleanup, render, screen, waitFor } from '@/lib/test-utils';

const mockUseLocalSearchParams = jest.fn();
const mutateMock = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockUseLocalSearchParams(),
  Stack: { Screen: () => null },
}));

jest.mock('@/api', () => ({
  useAddPost: () => ({ mutate: mutateMock, isPending: false }),
}));

jest.mock('@/lib/assessment/community-post-prefill', () => ({
  generateCommunityPostPrefill: jest.fn(),
}));

jest.mock('@/lib/assessment/current-assessment-store', () => ({
  getAssessmentSession: jest.fn(),
}));

const generateCommunityPostPrefillMock = jest.mocked(
  generateCommunityPostPrefill
);
const getAssessmentSessionMock = jest.mocked(getAssessmentSession);

describe('AddPost screen assessment prefill', () => {
  const originalConsoleWarn = console.warn;

  beforeEach(() => {
    jest.clearAllMocks();
    mutateMock.mockReset();
    mockUseLocalSearchParams.mockReset();
    mockUseLocalSearchParams.mockReturnValue({});
    generateCommunityPostPrefillMock.mockReset();
    getAssessmentSessionMock.mockReset();
    console.warn = jest.fn();
  });

  afterEach(() => {
    cleanup();
    console.warn = originalConsoleWarn;
  });

  it('applies prefill data passed via route params', async () => {
    const title = 'Need help with leaves';
    const body = 'Lower leaves are turning yellow. Any advice?';
    const images = [
      {
        uri: 'https://cdn.example.com/prefill.jpg',
        filename: 'prefill.jpg',
        size: 1024,
      },
    ];

    mockUseLocalSearchParams.mockReturnValue({
      source: 'assessment',
      assessmentId: 'assessment-123',
      prefillTitle: title,
      prefillBody: body,
      prefillImages: JSON.stringify(images),
    });

    render(<AddPost />);

    await screen.findByDisplayValue(title);
    expect(generateCommunityPostPrefillMock).not.toHaveBeenCalled();

    const bodyInput = await screen.findByDisplayValue(
      /Lower leaves are turning yellow/
    );
    expect(bodyInput).toBeTruthy();
    expect(screen.getByText('Prefilled images')).toBeOnTheScreen();
  });

  it('falls back to assessment session when params missing', async () => {
    const assessmentId = 'assessment-456';
    mockUseLocalSearchParams.mockReturnValue({
      source: 'assessment',
      assessmentId,
    });

    const mockedSession: AssessmentSession = {
      result: {
        topClass: {
          id: 'test-class',
          name: 'Test Class',
          category: 'nutrient',
          description: 'desc',
          visualCues: [],
          isOod: false,
          actionTemplate: {
            immediateSteps: [],
            shortTermActions: [],
            diagnosticChecks: [],
            warnings: [],
            disclaimers: [],
          },
          createdAt: Date.now(),
        },
        rawConfidence: 0.6,
        calibratedConfidence: 0.6,
        perImage: [],
        modelVersion: '1.0.0',
        processingTimeMs: 1000,
        aggregationMethod: 'highest-confidence',
        mode: 'device',
      },
      plantContext: {
        id: 'plant-1',
        nickname: 'Plant name',
        metadata: {},
      } as AssessmentSession['plantContext'],
      photos: [],
      createdAt: Date.now(),
    };

    getAssessmentSessionMock.mockReturnValue(mockedSession);

    generateCommunityPostPrefillMock.mockResolvedValue({
      title: 'Assessment fallback post',
      body: 'Generated body from fallback prefill.',
      images: [
        {
          uri: 'https://cdn.example.com/fallback.jpg',
          filename: 'fallback.jpg',
          size: 2048,
        },
      ],
      tags: ['ai-assessment'],
      sourceAssessmentId: assessmentId,
    });

    render(<AddPost />);

    await waitFor(() =>
      expect(generateCommunityPostPrefillMock).toHaveBeenCalled()
    );
    expect(generateCommunityPostPrefillMock).toHaveBeenCalledWith({
      assessment: mockedSession.result,
      assessmentId,
      plantContext: mockedSession.plantContext,
      capturedPhotos: mockedSession.photos as any,
    });

    await screen.findByDisplayValue('Assessment fallback post');
    expect(screen.getByText('Prefilled images')).toBeOnTheScreen();
  });
});
