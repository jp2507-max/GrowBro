import { router } from 'expo-router';

import { translate, translateDynamic } from '@/lib/i18n/utils';
import type { DiagnosticResult } from '@/lib/nutrient-engine/types';

/**
 * Navigate to community post creation with diagnostic context
 * for getting a second opinion from experienced growers
 */
export function navigateToSecondOpinion(result: DiagnosticResult): void {
  const postBody = buildDiagnosticSummaryForPost(result);

  // Navigate to community post creation with prefilled content
  // The community screen will handle the deep-link parameters
  router.push({
    pathname: '/add-post',
    params: {
      prefilled_body: postBody,
      context: 'diagnostic-second-opinion',
      diagnostic_id: result.id,
    },
  });
}

/**
 * Build a diagnostic summary formatted for community post
 */
function buildDiagnosticSummaryForPost(result: DiagnosticResult): string {
  const lines: string[] = [];

  // Header
  lines.push(translate('nutrient.diagnostics.community.header'));
  lines.push('');

  // Classification
  const issueType = translate(
    `nutrient.diagnostics.issue_types.${result.classification.type}`
  );
  lines.push(
    `${translate('nutrient.diagnostics.community.classification')}: ${issueType}`
  );

  if (result.nutrientCode) {
    lines.push(
      `${translate('nutrient.diagnostics.nutrient')}: ${result.nutrientCode}`
    );
  }

  // Confidence
  const confidencePercent = Math.round(result.confidence * 100);
  lines.push(
    `${translate('nutrient.diagnostics.community.confidence')}: ${confidencePercent}%`
  );

  // Symptoms
  if (result.symptoms && result.symptoms.length > 0) {
    lines.push('');
    lines.push(translate('nutrient.diagnostics.community.symptoms'));
    result.symptoms.forEach((symptom) => {
      const location = symptom.location ? ` (${symptom.location})` : '';
      lines.push(`• ${symptom.type}${location}`);
    });
  }

  // Top recommendations
  if (result.recommendations && result.recommendations.length > 0) {
    lines.push('');
    lines.push(translate('nutrient.diagnostics.community.recommendations'));
    result.recommendations.slice(0, 3).forEach((rec) => {
      lines.push(`• ${translateDynamic(rec.description)}`);
    });
  }

  // Footer
  lines.push('');
  lines.push(translate('nutrient.diagnostics.community.footer'));

  return lines.join('\n');
}
