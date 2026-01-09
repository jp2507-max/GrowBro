import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { router } from 'expo-router';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import {
  generateRetakeGuidance,
  getIssueDescription,
} from '@/lib/assessment/retake-guidance';
import type { AssessmentPlantContext, QualityResult } from '@/types/assessment';

import { Button, Modal, Text, useModal, View } from '../ui';

const styles = StyleSheet.create({
  scrollViewContent: { padding: 24, paddingTop: 0 },
});

type RetakeGuidanceModalProps = {
  qualityScores: QualityResult[];
  plantContext?: AssessmentPlantContext;
  onClose: () => void;
  onRetake?: () => void;
  testID?: string;
};

export type RetakeGuidanceModalRef = BottomSheetModal;

/**
 * Modal that displays retake guidance based on quality assessment issues.
 * Provides specific tips for improving photo quality.
 *
 * Uses @gorhom/bottom-sheet for native swipe-to-dismiss behavior instead of
 * react-native Modal.
 *
 * Usage:
 * ```tsx
 * const { ref, present, dismiss } = useModal();
 *
 * <RetakeGuidanceModal
 *   ref={ref}
 *   qualityScores={scores}
 *   plantContext={context}
 *   onClose={dismiss}
 * />
 *
 * // To show the modal:
 * present();
 * ```
 */
export const RetakeGuidanceModal = React.forwardRef<
  RetakeGuidanceModalRef,
  RetakeGuidanceModalProps
>(function RetakeGuidanceModal(
  {
    qualityScores,
    plantContext,
    onClose,
    onRetake,
    testID = 'retake-guidance-modal',
  },
  ref
) {
  const { t } = useTranslation();

  const guidance = generateRetakeGuidance(qualityScores);
  const issueDescription = getIssueDescription(guidance.primaryIssue);

  const handleRetakeNow = React.useCallback(() => {
    onClose();

    if (onRetake) {
      onRetake();
    } else {
      // Navigate back to camera with plant context
      router.push({
        pathname: '/assessment/camera',
        params: {
          plantId: plantContext?.id,
        },
      });
    }
  }, [onClose, onRetake, plantContext?.id]);

  return (
    <Modal
      ref={ref}
      snapPoints={['80%']}
      title={t('assessment.retake.title')}
      enablePanDownToClose
      onDismiss={onClose}
      testID={testID}
    >
      <BottomSheetScrollView contentContainerStyle={styles.scrollViewContent}>
        {/* Subtitle */}
        <Text className="mb-4 text-base text-neutral-700 dark:text-neutral-300">
          {t('assessment.retake.subtitle')}
        </Text>

        {/* Primary issue */}
        <View className="dark:bg-warning-950 mb-4 rounded-lg bg-warning-100 p-4">
          <Text className="mb-1 text-sm font-semibold text-warning-900 dark:text-warning-100">
            {t('assessment.retake.primary_issue')}
          </Text>
          <Text className="text-base text-warning-800 dark:text-warning-200">
            {issueDescription}
          </Text>
        </View>

        {/* Tips */}
        <View className="mb-6">
          <Text className="mb-3 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            {t('assessment.retake.tips_title')}
          </Text>
          <View className="gap-3">
            {guidance.tips.map((tip, index) => (
              <View key={index} className="flex-row">
                <Text className="mr-2 text-primary-600 dark:text-primary-400">
                  •
                </Text>
                <Text className="flex-1 text-base text-neutral-700 dark:text-neutral-300">
                  {tip}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Action buttons */}
        <View className="gap-3">
          <Button
            label={t('assessment.retake.retake_now')}
            onPress={handleRetakeNow}
            testID={`${testID}-retake-button`}
          />
          <Button
            label={t('assessment.retake.cancel')}
            onPress={onClose}
            variant="ghost"
            testID={`${testID}-cancel-button`}
          />
        </View>
      </BottomSheetScrollView>
    </Modal>
  );
});

// Re-export useModal for convenience
export { useModal };
