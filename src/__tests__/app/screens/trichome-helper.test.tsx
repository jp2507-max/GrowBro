import React from 'react';

import TrichomeHelperModal from '@/app/(modals)/trichome-helper';
import { cleanup, screen, setup, waitFor } from '@/lib/test-utils';
import type { HarvestSuggestion } from '@/lib/trichome';

afterEach(cleanup);

// Mock the trichome helper
const mockAcceptSuggestion = jest.fn();
const mockGetAssessmentGuide = jest.fn().mockReturnValue({
  stages: [],
  photographyTips: [],
  lightingCautions: [],
  disclaimer: 'Test disclaimer',
});
const mockGetHarvestWindows = jest.fn().mockReturnValue([]);
const mockLogTrichomeCheck = jest.fn();
const mockSuggestHarvestAdjustments = jest.fn();
const mockGetLatestAssessment = jest.fn();

jest.mock('@/lib/trichome', () => ({
  useTrichomeHelper: () => ({
    acceptSuggestion: mockAcceptSuggestion,
    getAssessmentGuide: mockGetAssessmentGuide,
    getHarvestWindows: mockGetHarvestWindows,
    logTrichomeCheck: mockLogTrichomeCheck,
    suggestHarvestAdjustments: mockSuggestHarvestAdjustments,
    getLatestAssessment: mockGetLatestAssessment,
  }),
}));

// Mock router
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({
    plantId: 'test-plant-id',
    playbookId: 'test-playbook-id',
  }),
  useRouter: () => ({
    back: jest.fn(),
  }),
}));

// Mock flash message
jest.mock('react-native-flash-message', () => ({
  showMessage: jest.fn(),
}));

describe('TrichomeHelperModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Harvest Suggestion Acceptance', () => {
    const mockSuggestion: HarvestSuggestion = {
      minDays: 0,
      maxDays: 3,
      targetEffect: 'energetic',
      reasoning: 'Test reasoning',
      requiresConfirmation: true,
    };

    test('calls acceptSuggestion API when accepting a suggestion', async () => {
      // Mock the latest assessment and suggestions
      mockGetLatestAssessment.mockResolvedValue({
        id: 'test-assessment',
        plantId: 'test-plant-id',
        assessmentDate: '2024-01-01',
        clearPercent: 10,
        milkyPercent: 70,
        amberPercent: 20,
        createdAt: '2024-01-01T00:00:00Z',
      });

      mockSuggestHarvestAdjustments.mockResolvedValue([mockSuggestion]);

      const { user } = setup(<TrichomeHelperModal />);

      // Switch to windows tab where suggestions appear
      const windowsTab = screen.getByTestId('windows-tab');
      await user.press(windowsTab);

      // Wait for suggestions to appear
      await waitFor(() => {
        expect(
          screen.getByTestId('accept-suggestion-button')
        ).toBeOnTheScreen();
      });

      // Click accept button
      const acceptButton = screen.getByTestId('accept-suggestion-button');
      await user.press(acceptButton);

      // Verify API was called
      await waitFor(() => {
        expect(mockAcceptSuggestion).toHaveBeenCalledWith(
          'test-plant-id',
          mockSuggestion
        );
      });
    });

    test('removes suggestion from UI immediately when accepted (optimistic update)', async () => {
      mockGetLatestAssessment.mockResolvedValue({
        id: 'test-assessment',
        plantId: 'test-plant-id',
        assessmentDate: '2024-01-01',
        clearPercent: 10,
        milkyPercent: 70,
        amberPercent: 20,
        createdAt: '2024-01-01T00:00:00Z',
      });

      mockSuggestHarvestAdjustments.mockResolvedValue([mockSuggestion]);

      const { user } = setup(<TrichomeHelperModal />);

      // Switch to windows tab where suggestions appear
      const windowsTab = screen.getByTestId('windows-tab');
      await user.press(windowsTab);

      // Wait for suggestions to appear
      await waitFor(() => {
        expect(
          screen.getByTestId('accept-suggestion-button')
        ).toBeOnTheScreen();
      });

      // Click accept button
      const acceptButton = screen.getByTestId('accept-suggestion-button');
      await user.press(acceptButton);

      // Verify suggestion is removed from UI immediately
      await waitFor(() => {
        expect(
          screen.queryByTestId('accept-suggestion-button')
        ).not.toBeOnTheScreen();
      });
    });

    test('rolls back UI changes when API call fails', async () => {
      mockGetLatestAssessment.mockResolvedValue({
        id: 'test-assessment',
        plantId: 'test-plant-id',
        assessmentDate: '2024-01-01',
        clearPercent: 10,
        milkyPercent: 70,
        amberPercent: 20,
        createdAt: '2024-01-01T00:00:00Z',
      });

      mockSuggestHarvestAdjustments.mockResolvedValue([mockSuggestion]);
      mockAcceptSuggestion.mockRejectedValue(new Error('API failed'));

      const { user } = setup(<TrichomeHelperModal />);

      // Switch to windows tab where suggestions appear
      const windowsTab = screen.getByTestId('windows-tab');
      await user.press(windowsTab);

      // Wait for suggestions to appear
      await waitFor(() => {
        expect(
          screen.getByTestId('accept-suggestion-button')
        ).toBeOnTheScreen();
      });

      // Click accept button
      const acceptButton = screen.getByTestId('accept-suggestion-button');
      await user.press(acceptButton);

      // Wait for rollback to happen (button should reappear)
      await waitFor(() => {
        expect(
          screen.getByTestId('accept-suggestion-button')
        ).toBeOnTheScreen();
      });

      // Verify API was called
      expect(mockAcceptSuggestion).toHaveBeenCalledWith(
        'test-plant-id',
        mockSuggestion
      );
    });
  });
});
