import { router } from 'expo-router';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ScrollView } from 'react-native';

import {
  generateRetakeGuidance,
  getIssueDescription,
} from '@/lib/assessment/retake-guidance';
import type { AssessmentPlantContext, QualityResult } from '@/types/assessment';

import { Button, Text, View } from '../ui';

type RetakeGuidanceModalProps = {
  visible: boolean;
  qualityScores: QualityResult[];
  plantContext?: AssessmentPlantContext;
  onClose: () => void;
  onRetake?: () => void;
  testID?: string;
};

/**
 * Modal that displays retake guidance based on quality assessment issues.
 * Provides specific tips for improving photo quality.
 */
export function RetakeGuidanceModal({
  visible,
  qualityScores,
  plantContext,
  onClose,
  onRetake,
  testID = 'retake-guidance-modal',
}: RetakeGuidanceModalProps) {
  const { t } = useTranslation();

  const guidance = generateRetakeGuidance(qualityScores);
  const issueDescription = getIssueDescription(guidance.primaryIssue);

  const handleRetakeNow = () => {
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
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      testID={testID}
    >
      <View className="flex-1 justify-end bg-black/50">
        <View className="max-h-[80%] rounded-t-3xl bg-neutral-50 dark:bg-neutral-900">
          <ScrollView className="p-6">
            {/* Header */}
            <View className="mb-4">
              <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                {t('assessment.retake.title')}
              </Text>
              <Text className="mt-2 text-base text-neutral-700 dark:text-neutral-300">
                {t('assessment.retake.subtitle')}
              </Text>
            </View>

            {/* Primary issue */}
            <View className="dark:bg-warning-950 mb-4 rounded-lg bg-warning-100 p-4">
              <Text className="mb-1 text-sm font-semibold text-warning-900 dark:text-warning-100">
                {t('assessment.retake.primaryIssue')}
              </Text>
              <Text className="text-base text-warning-800 dark:text-warning-200">
                {issueDescription}
              </Text>
            </View>

            {/* Tips */}
            <View className="mb-6">
              <Text className="mb-3 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                {t('assessment.retake.tipsTitle')}
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
                label={t('assessment.retake.retakeNow')}
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
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
