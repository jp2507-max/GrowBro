import * as React from 'react';
import { useTranslation } from 'react-i18next';

import type { AssessmentResult } from '@/types/assessment';

import { Button, Text, View } from '../ui';
import { CommunityCTAButton } from './community-cta-button';
import { DiagnosticChecklist } from './diagnostic-checklist';

type UncertaintyResultCardProps = {
  assessment: AssessmentResult;
  assessmentId: string;
  plantId: string;
  onRetake?: () => void;
  testID?: string;
};

/**
 * Result card for uncertain or low-confidence AI assessments.
 * Shows neutral messaging, community CTA, and diagnostic checklist.
 */
export function UncertaintyResultCard({
  assessment,
  assessmentId,
  plantId,
  onRetake,
  testID = 'uncertainty-result-card',
}: UncertaintyResultCardProps) {
  const { t } = useTranslation();
  const [showChecklist, setShowChecklist] = React.useState(false);

  const isOOD = assessment.topClass.isOod;
  const isLowConfidence = assessment.calibratedConfidence < 0.7;

  // Determine header message
  const headerKey = isOOD
    ? 'assessment.uncertainty.unableToClassify'
    : 'assessment.uncertainty.notConfident';

  // Determine explanation message
  const explanationKey = isOOD
    ? 'assessment.uncertainty.oodExplanation'
    : 'assessment.uncertainty.lowConfidenceExplanation';

  return (
    <View
      className="dark:bg-warning-950 rounded-xl border-2 border-warning-400 bg-warning-50 p-4 dark:border-warning-600"
      testID={testID}
    >
      {/* Header */}
      <View className="mb-3">
        <Text className="text-lg font-semibold text-warning-900 dark:text-warning-100">
          {t(headerKey)}
        </Text>
        <Text className="mt-1 text-sm text-warning-800 dark:text-warning-200">
          {t(explanationKey)}
        </Text>
      </View>

      {/* Confidence display for low confidence (not OOD) */}
      {isLowConfidence && !isOOD && (
        <View className="mb-3 rounded-lg bg-warning-100 p-3 dark:bg-warning-900">
          <Text className="text-sm text-warning-900 dark:text-warning-100">
            {t('assessment.uncertainty.confidenceLabel')}:{' '}
            {Math.round(assessment.calibratedConfidence * 100)}%
          </Text>
          <Text className="mt-1 text-xs text-warning-700 dark:text-warning-300">
            {t('assessment.uncertainty.confidenceThreshold')}
          </Text>
        </View>
      )}

      {/* Action buttons */}
      <View className="gap-3">
        {/* Retake button */}
        {onRetake && (
          <Button
            label={t('assessment.uncertainty.retakePhoto')}
            onPress={onRetake}
            variant="default"
            testID={`${testID}-retake-button`}
          />
        )}

        {/* Community CTA */}
        <CommunityCTAButton
          assessment={assessment}
          assessmentId={assessmentId}
          testID={`${testID}-community-cta`}
        />

        {/* Diagnostic checklist toggle */}
        <Button
          label={
            showChecklist
              ? t('assessment.uncertainty.hideChecklist')
              : t('assessment.uncertainty.showChecklist')
          }
          onPress={() => setShowChecklist(!showChecklist)}
          variant="ghost"
          testID={`${testID}-checklist-toggle`}
        />
      </View>

      {/* Diagnostic checklist (collapsible) */}
      {showChecklist && (
        <View className="mt-4">
          <DiagnosticChecklist
            plantId={plantId}
            testID={`${testID}-checklist`}
          />
        </View>
      )}

      {/* Educational note */}
      <View className="mt-4 rounded-lg bg-warning-100 p-3 dark:bg-warning-900">
        <Text className="text-xs text-warning-800 dark:text-warning-200">
          {t('assessment.uncertainty.educationalNote')}
        </Text>
      </View>
    </View>
  );
}
