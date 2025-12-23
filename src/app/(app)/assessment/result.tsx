import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import {
  CommunityCTAButton,
  RetakeGuidanceModal,
  UncertaintyResultCard,
} from '@/components/assessment';
import { Button, Text, View } from '@/components/ui';
import { shouldShowCommunityCTA } from '@/lib/assessment/community-cta';
import type { AssessmentSession } from '@/lib/assessment/current-assessment-store';
import {
  clearAssessmentSession,
  getAssessmentSession,
} from '@/lib/assessment/current-assessment-store';
import {
  generateRetakeGuidance,
  shouldRecommendRetake,
} from '@/lib/assessment/retake-guidance';
import type { AssessmentResult, QualityResult } from '@/types/assessment';

function getQualityScores(
  result: AssessmentResult | undefined
): QualityResult[] {
  if (!result) {
    return [];
  }

  return result.perImage
    .map((item) => item.quality)
    .filter(Boolean) as QualityResult[];
}

export default function AssessmentResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const assessmentIdParam = params.assessmentId;
  const assessmentId =
    typeof assessmentIdParam === 'string' ? assessmentIdParam : undefined;

  const session = React.useMemo(() => {
    if (!assessmentId) {
      return undefined;
    }
    return getAssessmentSession(assessmentId);
  }, [assessmentId]);

  const [showRetakeModal, setShowRetakeModal] = React.useState(false);

  const qualityScores = React.useMemo(
    () => getQualityScores(session?.result),
    [session?.result]
  );

  const retakeRecommended = React.useMemo(
    () => shouldRecommendRetake(qualityScores),
    [qualityScores]
  );

  const guidance = React.useMemo(() => {
    if (!qualityScores.length) {
      return null;
    }
    return generateRetakeGuidance(qualityScores);
  }, [qualityScores]);

  const handleRetake = React.useCallback(() => {
    setShowRetakeModal(false);
    if (assessmentId && session?.plantContext?.id) {
      clearAssessmentSession(assessmentId);
      router.replace({
        pathname: '/assessment/capture',
        params: { plantId: session.plantContext.id },
      });
    } else {
      router.replace('/assessment/capture');
    }
  }, [assessmentId, router, session?.plantContext?.id]);

  const handleOpenRetakeModal = React.useCallback(() => {
    setShowRetakeModal(true);
  }, []);

  const handleCloseRetakeModal = React.useCallback(() => {
    setShowRetakeModal(false);
  }, []);

  const handleDismiss = React.useCallback(() => {
    router.replace('/');
  }, [router]);

  if (!assessmentId || !session) {
    return <MissingAssessmentSession onDismiss={handleDismiss} />;
  }

  const { result, plantContext } = session;
  const uncertain = shouldShowCommunityCTA(result);
  const confidencePercent = Math.round(result.calibratedConfidence * 100);

  return (
    <AssessmentResultLayout
      assessmentId={assessmentId}
      result={result}
      plantContext={plantContext}
      uncertain={uncertain}
      confidencePercent={confidencePercent}
      onRetake={handleRetake}
      onOpenRetakeModal={handleOpenRetakeModal}
      onCloseRetakeModal={handleCloseRetakeModal}
      showRetakeModal={showRetakeModal}
      retakeRecommended={retakeRecommended}
      guidance={guidance}
      qualityScores={qualityScores}
    />
  );
}

type AssessmentResultLayoutProps = {
  assessmentId: string;
  result: AssessmentResult;
  plantContext: AssessmentSession['plantContext'];
  uncertain: boolean;
  confidencePercent: number;
  onRetake: () => void;
  onOpenRetakeModal: () => void;
  onCloseRetakeModal: () => void;
  showRetakeModal: boolean;
  retakeRecommended: boolean;
  guidance: ReturnType<typeof generateRetakeGuidance> | null;
  qualityScores: QualityResult[];
};

function AssessmentResultLayout({
  assessmentId,
  result,
  plantContext,
  uncertain,
  confidencePercent,
  onRetake,
  onOpenRetakeModal,
  onCloseRetakeModal,
  showRetakeModal,
  retakeRecommended,
  guidance,
  qualityScores,
}: AssessmentResultLayoutProps) {
  const { t } = useTranslation();

  return (
    <>
      <Stack.Screen options={{ title: t('assessment.result.screenTitle') }} />
      <ScrollView
        className="flex-1 bg-neutral-50 dark:bg-charcoal-950"
        contentContainerClassName="pb-16"
      >
        <View className="px-4 pt-4">
          {uncertain ? (
            <UncertaintyResultCard
              assessment={result}
              assessmentId={assessmentId}
              plantId={plantContext.id}
              onRetake={onRetake}
            />
          ) : (
            <View className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-charcoal-700 dark:bg-charcoal-900">
              <Text className="text-xl font-semibold text-charcoal-900 dark:text-neutral-100">
                {result.topClass.name}
              </Text>
              <Text className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                {t('assessment.result.confidence', { confidencePercent })}
              </Text>
              <Text className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
                {result.topClass.description ||
                  t('assessment.result.noDescription')}
              </Text>
              <CommunityCTAButton
                assessment={result}
                assessmentId={assessmentId}
                testID="result-community-cta"
              />
              <Button
                className="mt-4"
                label={t('assessment.result.retakePhotos')}
                onPress={onRetake}
                variant="outline"
              />
            </View>
          )}

          <View className="mt-6 rounded-xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-charcoal-900">
            <Text className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              {t('assessment.result.details')}
            </Text>
            <Text className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
              {t('assessment.result.modelVersion', {
                modelVersion: result.modelVersion,
              })}
            </Text>
            <Text className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              {t('assessment.result.processingTime', {
                processingTimeMs: result.processingTimeMs,
              })}
            </Text>
            <Text className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              {t('assessment.result.plantId', {
                plantId: plantContext.id || t('assessment.result.unknown'),
              })}
            </Text>
          </View>

          {retakeRecommended && guidance && (
            <View className="dark:bg-warning-950 mt-6 rounded-xl border border-warning-400 bg-warning-50 p-4 dark:border-warning-500">
              <Text className="text-lg font-semibold text-warning-900 dark:text-warning-100">
                {t('assessment.result.photoQualityTitle')}
              </Text>
              <Text className="mt-1 text-sm text-warning-800 dark:text-warning-200">
                {guidance.tips[0]}
              </Text>
              <Button
                className="mt-4"
                label={t('assessment.result.viewPhotoTips')}
                onPress={onOpenRetakeModal}
                variant="outline"
              />
            </View>
          )}
        </View>
      </ScrollView>

      <RetakeGuidanceModal
        visible={showRetakeModal}
        onClose={onCloseRetakeModal}
        onRetake={onRetake}
        qualityScores={qualityScores}
        plantContext={plantContext}
      />
    </>
  );
}

type MissingAssessmentSessionProps = {
  onDismiss: () => void;
};

function MissingAssessmentSession({
  onDismiss,
}: MissingAssessmentSessionProps) {
  const { t } = useTranslation();

  return (
    <View className="flex-1 items-center justify-center bg-neutral-50 px-6 dark:bg-charcoal-950">
      <Stack.Screen options={{ title: t('assessment.result.screenTitle') }} />
      <Text className="mb-6 text-center text-lg text-neutral-900 dark:text-neutral-100">
        {t('assessment.result.dataUnavailable')}
      </Text>
      <Button label={t('assessment.result.backToHome')} onPress={onDismiss} />
    </View>
  );
}
