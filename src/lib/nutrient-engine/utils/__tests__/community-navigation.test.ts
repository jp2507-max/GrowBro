import { router } from 'expo-router';

import { translate } from '@/lib/i18n/utils';
import type { DiagnosticResult, Symptom } from '@/lib/nutrient-engine/types';
import { IssueSeverity, IssueType } from '@/lib/nutrient-engine/types';

import { navigateToSecondOpinion } from '../community-navigation';

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
  },
}));

jest.mock('@/lib/i18n/utils', () => ({
  translate: jest.fn((key: string) => key),
  translateDynamic: jest.fn((key: string) => key),
}));

describe('navigateToSecondOpinion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('navigates to community post creation with diagnostic context', () => {
    const result: DiagnosticResult = {
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
        likelyCauses: [],
      },
      nutrientCode: 'N',
      confidence: 0.65,
      recommendations: [
        {
          action: 'nitrogenFeed',
          description: 'nutrient.diagnostics.recommendations.nitrogenFeed',
          priority: 1,
        },
      ],
      confidenceSource: 'rules',
      rulesBased: true,
      needsSecondOpinion: true,
      confidenceFlags: [],
      feedback: { helpfulCount: 0, notHelpfulCount: 0 },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    navigateToSecondOpinion(result);

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/add-post',
      params: expect.objectContaining({
        context: 'diagnostic-second-opinion',
        diagnostic_id: 'diag-1',
        prefilled_body: expect.any(String),
      }),
    });

    expect(router.push).toHaveBeenCalledTimes(1);
  });

  test('includes symptoms in prefilled post body', () => {
    const symptoms: Symptom[] = [
      {
        type: 'yellowing',
        location: 'lower leaves',
        severity: IssueSeverity.MODERATE,
      },
      {
        type: 'tip_burn',
        location: 'upper leaves',
        severity: IssueSeverity.MILD,
      },
    ];

    const result: DiagnosticResult = {
      id: 'diag-2',
      plantId: 'plant-2',
      symptoms,
      classification: {
        type: IssueType.TOXICITY,
        severity: IssueSeverity.SEVERE,
        nutrient: 'P',
        likelyCauses: [],
      },
      confidence: 0.62,
      recommendations: [],
      confidenceSource: 'hybrid',
      rulesBased: true,
      needsSecondOpinion: true,
      confidenceFlags: [],
      feedback: { helpfulCount: 0, notHelpfulCount: 0 },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    navigateToSecondOpinion(result);

    const callArgs = (router.push as jest.Mock).mock.calls[0][0];
    const prefilledBody = callArgs.params.prefilled_body;

    expect(prefilledBody).toContain('nutrient.diagnostics.community.symptoms');
    expect(prefilledBody).toContain('yellowing');
    expect(prefilledBody).toContain('tip_burn');
  });

  test('includes top 3 recommendations in prefilled post body', () => {
    const result: DiagnosticResult = {
      id: 'diag-3',
      plantId: 'plant-3',
      symptoms: [],
      classification: {
        type: IssueType.DEFICIENCY,
        severity: IssueSeverity.MODERATE,
        nutrient: 'N',
        likelyCauses: [],
      },
      confidence: 0.68,
      recommendations: [
        {
          action: 'rec1',
          description: 'nutrient.diagnostics.recommendations.nitrogenFeed',
          priority: 1,
        },
        {
          action: 'rec2',
          description: 'nutrient.diagnostics.recommendations.monitor48h',
          priority: 2,
        },
        {
          action: 'rec3',
          description:
            'nutrient.diagnostics.recommendations.increaseMonitoring',
          priority: 2,
        },
        {
          action: 'rec4',
          description: 'nutrient.diagnostics.recommendations.retest12h',
          priority: 3,
        },
      ],
      confidenceSource: 'ai',
      rulesBased: false,
      needsSecondOpinion: true,
      confidenceFlags: [],
      feedback: { helpfulCount: 0, notHelpfulCount: 0 },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    navigateToSecondOpinion(result);

    const callArgs = (router.push as jest.Mock).mock.calls[0][0];
    const prefilledBody = callArgs.params.prefilled_body;

    expect(prefilledBody).toContain(
      'nutrient.diagnostics.community.recommendations'
    );
    expect(prefilledBody).toContain(
      'nutrient.diagnostics.recommendations.nitrogenFeed'
    );
    expect(prefilledBody).toContain(
      'nutrient.diagnostics.recommendations.monitor48h'
    );
    expect(prefilledBody).toContain(
      'nutrient.diagnostics.recommendations.increaseMonitoring'
    );
    // Fourth recommendation should not be included
    expect(prefilledBody).not.toContain(
      'nutrient.diagnostics.recommendations.retest12h'
    );
  });

  test('includes confidence percentage in prefilled post body', () => {
    const result: DiagnosticResult = {
      id: 'diag-4',
      plantId: 'plant-4',
      symptoms: [],
      classification: {
        type: IssueType.PH_DRIFT,
        severity: IssueSeverity.MODERATE,
        likelyCauses: [],
      },
      confidence: 0.73,
      recommendations: [],
      confidenceSource: 'rules',
      rulesBased: true,
      needsSecondOpinion: false,
      confidenceFlags: [],
      feedback: { helpfulCount: 0, notHelpfulCount: 0 },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    navigateToSecondOpinion(result);

    const callArgs = (router.push as jest.Mock).mock.calls[0][0];
    const prefilledBody = callArgs.params.prefilled_body;

    expect(prefilledBody).toContain('73%');
  });

  test('formats post with header and footer', () => {
    const result: DiagnosticResult = {
      id: 'diag-5',
      plantId: 'plant-5',
      symptoms: [],
      classification: {
        type: IssueType.LOCKOUT,
        severity: IssueSeverity.SEVERE,
        likelyCauses: [],
      },
      confidence: 0.55,
      recommendations: [],
      confidenceSource: 'hybrid',
      rulesBased: true,
      needsSecondOpinion: true,
      confidenceFlags: [],
      feedback: { helpfulCount: 0, notHelpfulCount: 0 },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    navigateToSecondOpinion(result);

    expect(translate).toHaveBeenCalledWith(
      'nutrient.diagnostics.community.header'
    );
    expect(translate).toHaveBeenCalledWith(
      'nutrient.diagnostics.community.footer'
    );

    const callArgs = (router.push as jest.Mock).mock.calls[0][0];
    const prefilledBody = callArgs.params.prefilled_body;

    expect(prefilledBody).toContain('nutrient.diagnostics.community.header');
    expect(prefilledBody).toContain('nutrient.diagnostics.community.footer');
  });
});
