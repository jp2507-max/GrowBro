import { router } from 'expo-router';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { showMessage } from 'react-native-flash-message';

import { logUserAction } from '@/lib/assessment/assessment-telemetry-service';
import { shouldShowCommunityCTA } from '@/lib/assessment/community-cta';
import { generateCommunityPostPrefill } from '@/lib/assessment/community-post-prefill';
import { getAssessmentSession } from '@/lib/assessment/current-assessment-store';
import type { AssessmentResult } from '@/types/assessment';

import { Button, Text, View } from '../ui';

type CommunityCTAButtonProps = {
  assessment: AssessmentResult;
  assessmentId: string;
  onPress?: () => void;
  testID?: string;
};

/**
 * Generate prefill data and navigate to community post creation
 */
async function navigateToPostCreation(
  assessmentId: string,
  assessment: AssessmentResult
): Promise<void> {
  const session = getAssessmentSession(assessmentId);
  if (!session) {
    showMessage({
      message: 'Error',
      description: 'Assessment data is no longer available.',
      type: 'danger',
      duration: 3000,
    });
    return;
  }

  const prefillData = await generateCommunityPostPrefill({
    assessment,
    assessmentId,
    plantContext: session.plantContext,
    capturedPhotos: session.photos,
  });

  router.push({
    pathname: '/feed/add-post',
    params: {
      source: 'assessment',
      assessmentId,
      prefillTitle: prefillData.title,
      prefillBody: prefillData.body,
      prefillTags: JSON.stringify(prefillData.tags),
      prefillImages: JSON.stringify(
        prefillData.images.map((img) => ({
          uri: img.uri,
          filename: img.filename,
        }))
      ),
    },
  });
}

/**
 * Community CTA button that appears for low-confidence or OOD assessments.
 * Navigates to community post creation with prefilled assessment data.
 */
export function CommunityCTAButton({
  assessment,
  assessmentId,
  onPress,
  testID = 'community-cta-button',
}: CommunityCTAButtonProps) {
  const { t } = useTranslation();
  const [isNavigating, setIsNavigating] = React.useState(false);
  const shouldShowCta = shouldShowCommunityCTA(assessment);

  // Log CTA shown event on mount
  React.useEffect(() => {
    if (!shouldShowCta) {
      return;
    }

    logUserAction({
      assessmentId,
      action: 'community_cta_shown',
      metadata: {
        confidence: assessment.calibratedConfidence,
        isOod: assessment.topClass.isOod,
      },
    }).catch((error) => {
      console.error('Failed to log community CTA shown:', error);
    });
  }, [
    assessment.calibratedConfidence,
    assessment.topClass.isOod,
    assessmentId,
    shouldShowCta,
  ]);

  // Only show if CTA conditions are met
  if (!shouldShowCta) {
    return null;
  }

  const handlePress = async () => {
    setIsNavigating(true);

    try {
      // Log CTA tap event
      await logUserAction({
        assessmentId,
        action: 'community_cta_tapped',
        metadata: {
          confidence: assessment.calibratedConfidence,
          isOod: assessment.topClass.isOod,
        },
      });

      // Call custom onPress if provided
      if (onPress) {
        await onPress();
      }

      // Navigate with prefilled data
      await navigateToPostCreation(assessmentId, assessment);
    } catch (error) {
      console.error('Failed to navigate to community post:', error);
      showMessage({
        message: 'Error',
        description: 'Failed to prepare community post. Please try again.',
        type: 'danger',
        duration: 3000,
      });
    } finally {
      setIsNavigating(false);
    }
  };

  const isLowConfidence = assessment.calibratedConfidence < 0.7;
  const buttonLabel = isLowConfidence
    ? t('assessment.community.getSecondOpinion')
    : t('assessment.community.askCommunity');

  return (
    <View className="mt-4" testID={testID}>
      <Button
        label={buttonLabel}
        onPress={handlePress}
        loading={isNavigating}
        variant="outline"
        testID={`${testID}-action`}
      />
      <Text className="mt-2 text-center text-sm text-neutral-600 dark:text-neutral-400">
        {t('assessment.community.ctaHint')}
      </Text>
    </View>
  );
}
