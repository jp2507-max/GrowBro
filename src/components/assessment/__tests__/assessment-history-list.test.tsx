/**
 * Assessment History List Component Tests
 *
 * Tests the assessment history list component rendering and behavior.
 */

import React from 'react';

import { getAssessmentsByPlantId } from '@/lib/assessment/assessment-queries';
import { cleanup, render, screen, waitFor } from '@/lib/test-utils';

import { AssessmentHistoryList } from '../assessment-history-list';

// Mock the assessment queries
jest.mock('@/lib/assessment/assessment-queries', () => ({
  getAssessmentsByPlantId: jest.fn(),
}));

const mockGetAssessments = getAssessmentsByPlantId as jest.MockedFunction<
  typeof getAssessmentsByPlantId
>;

describe('AssessmentHistoryList', () => {
  const mockPlantId = 'plant-123';

  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  it('should render loading state initially', () => {
    mockGetAssessments.mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(<AssessmentHistoryList plantId={mockPlantId} />);

    expect(screen.getByText('Loading assessments...')).toBeOnTheScreen();
  });

  it('should render empty state when no assessments exist', async () => {
    mockGetAssessments.mockResolvedValue([]);

    render(<AssessmentHistoryList plantId={mockPlantId} />);

    await waitFor(() => {
      expect(screen.getByText('No assessments yet')).toBeOnTheScreen();
    });

    expect(
      screen.getByText('Use the AI assessment tool to analyze plant health')
    ).toBeOnTheScreen();
  });

  it('should render assessment cards when data is loaded', async () => {
    const mockAssessments = [
      {
        id: 'assessment-1',
        plantId: mockPlantId,
        status: 'completed',
        predictedClass: 'nitrogen_deficiency',
        calibratedConfidence: 0.85,
        inferenceMode: 'device',
        modelVersion: '1.0.0',
        issueResolved: false,
        createdAt: new Date('2025-01-15T10:00:00Z'),
        updatedAt: new Date('2025-01-15T10:00:00Z'),
      },
      {
        id: 'assessment-2',
        plantId: mockPlantId,
        status: 'completed',
        predictedClass: 'healthy',
        calibratedConfidence: 0.92,
        inferenceMode: 'cloud',
        modelVersion: '1.0.0',
        issueResolved: true,
        createdAt: new Date('2025-01-14T10:00:00Z'),
        updatedAt: new Date('2025-01-14T10:00:00Z'),
      },
    ];

    mockGetAssessments.mockResolvedValue(mockAssessments);

    render(<AssessmentHistoryList plantId={mockPlantId} />);

    await waitFor(() => {
      expect(screen.getByText('Nitrogen Deficiency')).toBeOnTheScreen();
    });

    expect(screen.getByText('Healthy')).toBeOnTheScreen();
    expect(screen.getByText('85% confidence')).toBeOnTheScreen();
    expect(screen.getByText('92% confidence')).toBeOnTheScreen();
  });

  it('should render error state when loading fails', async () => {
    mockGetAssessments.mockRejectedValue(new Error('Network error'));

    render(<AssessmentHistoryList plantId={mockPlantId} />);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeOnTheScreen();
    });
  });

  it('should call query with correct plant ID and limit', async () => {
    mockGetAssessments.mockResolvedValue([]);

    render(<AssessmentHistoryList plantId={mockPlantId} limit={25} />);

    await waitFor(() => {
      expect(mockGetAssessments).toHaveBeenCalledWith(mockPlantId, 25);
    });
  });

  it('should use default limit of 50 when not specified', async () => {
    mockGetAssessments.mockResolvedValue([]);

    render(<AssessmentHistoryList plantId={mockPlantId} />);

    await waitFor(() => {
      expect(mockGetAssessments).toHaveBeenCalledWith(mockPlantId, 50);
    });
  });
});
