import React from 'react';

import { DiagnosticResultCard } from '@/components/nutrient-engine/diagnostic-result-card';
import type { DiagnosticResult } from '@/lib/nutrient-engine/types';
import {
  ConfidenceSource,
  IssueSeverity,
  IssueType,
} from '@/lib/nutrient-engine/types';
import { cleanup, screen, setup } from '@/lib/test-utils';

import * as CommunityNavigation from '../../../lib/nutrient-engine/utils/community-navigation';

jest.mock('../../../lib/nutrient-engine/utils/community-navigation', () => ({
  navigateToSecondOpinion: jest.fn(),
}));

afterEach(cleanup);

const mockOnFeedback = jest.fn();

const baseDiagnosticResult: DiagnosticResult = {
  id: 'diag-1',
  plantId: 'plant-1',
  symptoms: [
    {
      type: 'yellowing',
      location: 'lower leaves',
      severity: IssueSeverity.MODERATE,
    },
  ],
  classification: {
    type: IssueType.DEFICIENCY,
    severity: IssueSeverity.MODERATE,
    nutrient: 'N',
    likelyCauses: ['insufficientNitrogen'],
  },
  nutrientCode: 'N',
  confidence: 0.85,
  confidenceBreakdown: {
    final: 0.85,
    threshold: 0.78,
    rules: 0.82,
    ai: 0.88,
  },
  recommendations: [
    {
      action: 'nitrogenFeed',
      description: 'nutrient.diagnostics.recommendations.nitrogen_feed',
      priority: 1,
      code: 'N_DEFICIENCY_FEED',
      context: { source: 'ai' },
    },
  ],
  inputReadingIds: ['reading-1'],
  confidenceSource: ConfidenceSource.AI,
  rulesBased: true,
  aiOverride: true,
  rulesConfidence: 0.82,
  aiConfidence: 0.88,
  confidenceThreshold: 0.78,
  rationale: ['nutrient.diagnostics.rationale.yellowing_lower_leaves'],
  disclaimerKeys: [],
  needsSecondOpinion: false,
  confidenceFlags: [],
  feedback: {
    helpfulCount: 0,
    notHelpfulCount: 0,
  },
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

describe('DiagnosticResultCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    test('renders diagnostic result with classification', async () => {
      setup(
        <DiagnosticResultCard
          result={baseDiagnosticResult}
          onFeedback={mockOnFeedback}
        />
      );

      expect(await screen.findByText('Nutrient Deficiency')).toBeOnTheScreen();
      expect(screen.getByText(/^Nutrient\s*:\s*N$/)).toBeOnTheScreen();
      expect(screen.getByText('Moderate')).toBeOnTheScreen();
    });

    test('renders confidence badge with correct percentage', async () => {
      setup(
        <DiagnosticResultCard
          result={baseDiagnosticResult}
          onFeedback={mockOnFeedback}
        />
      );

      const badge = await screen.findByTestId('confidence-badge');
      expect(badge).toBeOnTheScreen();
      expect(screen.getByText('85%')).toBeOnTheScreen();
    });

    test('renders confidence breakdown when available', async () => {
      setup(
        <DiagnosticResultCard
          result={baseDiagnosticResult}
          onFeedback={mockOnFeedback}
        />
      );

      expect(await screen.findByText('Confidence Breakdown')).toBeOnTheScreen();
      expect(screen.getByText(/Rules-based\s*:\s*82\s*%/)).toBeOnTheScreen();
      expect(screen.getByText(/AI-based\s*:\s*88\s*%/)).toBeOnTheScreen();
    });

    test('renders recommendations list with source tags', async () => {
      setup(
        <DiagnosticResultCard
          result={baseDiagnosticResult}
          onFeedback={mockOnFeedback}
        />
      );

      expect(await screen.findByText('Recommendations')).toBeOnTheScreen();
      expect(
        screen.getByText(
          'Increase nitrogen inputs according to the deficiency playbook.'
        )
      ).toBeOnTheScreen();
      expect(screen.getByText('ai')).toBeOnTheScreen();
    });

    test('renders disclaimers when present', async () => {
      const resultWithDisclaimers: DiagnosticResult = {
        ...baseDiagnosticResult,
        disclaimerKeys: [
          'nutrient.diagnostics.disclaimers.low_confidence',
          'nutrient.diagnostics.disclaimers.ai_only_primary',
        ],
      };

      setup(
        <DiagnosticResultCard
          result={resultWithDisclaimers}
          onFeedback={mockOnFeedback}
        />
      );

      // Look for the warning emoji and disclaimer content
      expect(await screen.findByText(/⚠️/)).toBeOnTheScreen();
      expect(
        screen.getByText(/Confidence is below the safety threshold/)
      ).toBeOnTheScreen();
    });

    test('shows second opinion CTA when needsSecondOpinion is true', async () => {
      const resultNeedingOpinion: DiagnosticResult = {
        ...baseDiagnosticResult,
        confidence: 0.65,
        needsSecondOpinion: true,
      };

      setup(
        <DiagnosticResultCard
          result={resultNeedingOpinion}
          onFeedback={mockOnFeedback}
        />
      );

      const cta = await screen.findByTestId(
        'diagnostic-result-card-second-opinion-cta'
      );
      expect(cta).toBeOnTheScreen();
      expect(
        screen.getByText('Get Second Opinion from Community')
      ).toBeOnTheScreen();
    });

    test('hides second opinion CTA when confidence is high', async () => {
      setup(
        <DiagnosticResultCard
          result={baseDiagnosticResult}
          onFeedback={mockOnFeedback}
        />
      );

      await screen.findByTestId('diagnostic-result-card');

      expect(
        screen.queryByTestId('diagnostic-result-card-second-opinion-cta')
      ).not.toBeOnTheScreen();
    });

    test('renders feedback buttons initially', async () => {
      setup(
        <DiagnosticResultCard
          result={baseDiagnosticResult}
          onFeedback={mockOnFeedback}
        />
      );

      expect(
        await screen.findByTestId('diagnostic-result-card-feedback-helpful')
      ).toBeOnTheScreen();
      expect(
        screen.getByTestId('diagnostic-result-card-feedback-not-helpful')
      ).toBeOnTheScreen();
    });
  });

  describe('Interactions', () => {
    test('calls onFeedback with helpful=true when helpful button pressed', async () => {
      const { user } = setup(
        <DiagnosticResultCard
          result={baseDiagnosticResult}
          onFeedback={mockOnFeedback}
        />
      );

      const helpfulButton = await screen.findByTestId(
        'diagnostic-result-card-feedback-helpful'
      );
      await user.press(helpfulButton);

      expect(mockOnFeedback).toHaveBeenCalledWith('diag-1', true);
      expect(mockOnFeedback).toHaveBeenCalledTimes(1);
    });

    test('calls onFeedback with helpful=false when not helpful button pressed', async () => {
      const { user } = setup(
        <DiagnosticResultCard
          result={baseDiagnosticResult}
          onFeedback={mockOnFeedback}
        />
      );

      const notHelpfulButton = await screen.findByTestId(
        'diagnostic-result-card-feedback-not-helpful'
      );
      await user.press(notHelpfulButton);

      expect(mockOnFeedback).toHaveBeenCalledWith('diag-1', false);
      expect(mockOnFeedback).toHaveBeenCalledTimes(1);
    });

    test('hides feedback buttons and shows thank you after feedback submitted', async () => {
      const { user } = setup(
        <DiagnosticResultCard
          result={baseDiagnosticResult}
          onFeedback={mockOnFeedback}
        />
      );

      const helpfulButton = await screen.findByTestId(
        'diagnostic-result-card-feedback-helpful'
      );
      await user.press(helpfulButton);

      expect(
        screen.queryByTestId('diagnostic-result-card-feedback-helpful')
      ).not.toBeOnTheScreen();
      expect(
        await screen.findByText('Thanks for your feedback!')
      ).toBeOnTheScreen();
    });

    test('navigates to community when second opinion CTA pressed', async () => {
      const resultNeedingOpinion: DiagnosticResult = {
        ...baseDiagnosticResult,
        confidence: 0.65,
        needsSecondOpinion: true,
      };

      const { user } = setup(
        <DiagnosticResultCard
          result={resultNeedingOpinion}
          onFeedback={mockOnFeedback}
        />
      );

      const cta = await screen.findByTestId(
        'diagnostic-result-card-second-opinion-cta'
      );
      await user.press(cta);

      expect(CommunityNavigation.navigateToSecondOpinion).toHaveBeenCalledWith(
        resultNeedingOpinion
      );
      expect(CommunityNavigation.navigateToSecondOpinion).toHaveBeenCalledTimes(
        1
      );
    });
  });

  describe('Edge Cases', () => {
    test('handles result without confidence breakdown', async () => {
      const resultWithoutBreakdown: DiagnosticResult = {
        ...baseDiagnosticResult,
        confidenceBreakdown: undefined,
      };

      setup(
        <DiagnosticResultCard
          result={resultWithoutBreakdown}
          onFeedback={mockOnFeedback}
        />
      );

      await screen.findByTestId('diagnostic-result-card');

      expect(
        screen.queryByText('nutrient.diagnostics.confidence_breakdown')
      ).not.toBeOnTheScreen();
    });

    test('handles result without nutrient code', async () => {
      const resultWithoutNutrient: DiagnosticResult = {
        ...baseDiagnosticResult,
        nutrientCode: undefined,
      };

      setup(
        <DiagnosticResultCard
          result={resultWithoutNutrient}
          onFeedback={mockOnFeedback}
        />
      );

      await screen.findByTestId('diagnostic-result-card');

      expect(screen.queryByText('N')).not.toBeOnTheScreen();
    });

    test('handles very low confidence with danger color', async () => {
      const lowConfidenceResult: DiagnosticResult = {
        ...baseDiagnosticResult,
        confidence: 0.45,
        needsSecondOpinion: true,
      };

      setup(
        <DiagnosticResultCard
          result={lowConfidenceResult}
          onFeedback={mockOnFeedback}
        />
      );

      const badge = await screen.findByTestId('confidence-badge');
      expect(badge).toBeOnTheScreen();
      expect(screen.getByText('45%')).toBeOnTheScreen();
    });
  });
});
