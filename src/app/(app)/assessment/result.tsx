import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as React from 'react';
import { ScrollView } from 'react-native';

import {
  CommunityCTAButton,
  RetakeGuidanceModal,
  UncertaintyResultCard,
} from '@/components/assessment';
import { Button, Text, View } from '@/components/ui';
import { shouldShowCommunityCTA } from '@/lib/assessment/community-cta';
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

  const handleDismiss = React.useCallback(() => {
    router.replace('/');
  }, [router]);

  if (!assessmentId || !session) {
    return (
      <View className="flex-1 items-center justify-center bg-charcoal-950 px-6">
        <Stack.Screen options={{ title: 'Assessment Result' }} />
        <Text className="mb-6 text-center text-lg text-neutral-100">
          Assessment data is no longer available.
        </Text>
        <Button label="Back to home" onPress={handleDismiss} />
      </View>
    );
  }

  const { result, plantContext } = session;
  const uncertain = shouldShowCommunityCTA(result);
  const confidencePercent = Math.round(result.calibratedConfidence * 100);

  return (
    <>
      <Stack.Screen options={{ title: 'Assessment Result' }} />
      <ScrollView
        className="flex-1 bg-neutral-50 dark:bg-neutral-950"
        contentContainerClassName="pb-16"
      >
        <View className="px-4 pt-4">
          {uncertain ? (
            <UncertaintyResultCard
              assessment={result}
              assessmentId={assessmentId}
              onRetake={handleRetake}
            />
          ) : (
            <View className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
              <Text className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                {result.topClass.name}
              </Text>
              <Text className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                Confidence: {confidencePercent}%
              </Text>
              <Text className="mt-3 text-sm text-neutral-700 dark:text-neutral-300">
                {result.topClass.description ||
                  'No additional description available.'}
              </Text>
              <CommunityCTAButton
                assessment={result}
                assessmentId={assessmentId}
                testID="result-community-cta"
              />
              <Button
                className="mt-4"
                label="Retake photos"
                onPress={handleRetake}
                variant="outline"
              />
            </View>
          )}

          <View className="mt-6 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
            <Text className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              Assessment details
            </Text>
            <Text className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
              Model version: {result.modelVersion}
            </Text>
            <Text className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
              Processing time: {result.processingTimeMs} ms
            </Text>
            <Text className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
              Plant ID: {plantContext.id || 'Unknown'}
            </Text>
          </View>

          {retakeRecommended && guidance && (
            <View className="dark:bg-warning-950 mt-6 rounded-xl border border-warning-400 bg-warning-50 p-4 dark:border-warning-500">
              <Text className="text-lg font-semibold text-warning-900 dark:text-warning-100">
                Photo quality could be improved
              </Text>
              <Text className="mt-1 text-sm text-warning-800 dark:text-warning-200">
                {guidance.tips[0]}
              </Text>
              <Button
                className="mt-4"
                label="View photo tips"
                onPress={() => setShowRetakeModal(true)}
                variant="outline"
              />
            </View>
          )}
        </View>
      </ScrollView>

      <RetakeGuidanceModal
        visible={showRetakeModal}
        onClose={() => setShowRetakeModal(false)}
        onRetake={handleRetake}
        qualityScores={qualityScores}
        plantContext={plantContext}
      />
    </>
  );
}
