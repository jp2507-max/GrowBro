/**
 * React Hook for Trichome Helper
 *
 * Provides access to trichome assessment functionality with analytics integration
 */

import { useDatabase } from '@nozbe/watermelondb/react';
import * as React from 'react';

import { useAnalytics } from '@/lib/use-analytics';
import type { TrichomeAssessment } from '@/types/playbook';

import { TrichomeHelper } from './trichome-helper';

function getDominantStage(
  assessment: Omit<TrichomeAssessment, 'id' | 'createdAt'>
) {
  const percentages = [
    assessment.clearPercent || 0,
    assessment.milkyPercent || 0,
    assessment.amberPercent || 0,
  ];
  const maxPercent = Math.max(...percentages);
  const stage: 'clear' | 'milky' | 'cloudy' | 'amber' =
    maxPercent === percentages[0]
      ? 'clear'
      : maxPercent === percentages[2]
        ? 'amber'
        : 'milky';
  return { stage, confidence: maxPercent / 100 };
}

export function useTrichomeHelper() {
  const database = useDatabase();
  const analytics = useAnalytics();
  const helper = React.useMemo(() => new TrichomeHelper(database), [database]);

  const getAssessmentGuide = React.useCallback(
    (playbookId?: string) => {
      analytics.track('trichome_helper_open', {
        playbookId: playbookId || 'unknown',
      });
      return helper.getAssessmentGuide();
    },
    [helper, analytics]
  );

  const logTrichomeCheck = React.useCallback(
    async (
      assessment: Omit<TrichomeAssessment, 'id' | 'createdAt'>,
      playbookId?: string
    ) => {
      const result = await helper.logTrichomeCheck(assessment);
      const { stage, confidence } = getDominantStage(assessment);

      analytics.track('trichome_helper_logged', {
        playbookId: playbookId || 'unknown',
        trichomeStage: stage,
        assessmentConfidence: confidence,
      });

      return result;
    },
    [helper, analytics]
  );

  return {
    getAssessmentGuide,
    getHarvestWindows: () => helper.getHarvestWindows(),
    getMacroPhotographyTips: () => helper.getMacroPhotographyTips(),
    logTrichomeCheck,
    suggestHarvestAdjustments: (a: TrichomeAssessment) =>
      helper.suggestHarvestAdjustments(a),
    getAssessmentsForPlant: (id: string) => helper.getAssessmentsForPlant(id),
    getLatestAssessment: (id: string) => helper.getLatestAssessment(id),
  };
}
