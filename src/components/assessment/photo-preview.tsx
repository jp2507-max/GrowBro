import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { Button, Image, Text, View } from '@/components/ui';
import type { CapturedPhoto, QualityIssue } from '@/types/assessment';

type PhotoPreviewProps = {
  photo: CapturedPhoto;
  onRetake: () => void;
  onAccept: () => void;
  isLastPhoto: boolean;
};

export function PhotoPreview({
  photo,
  onRetake,
  onAccept,
  isLastPhoto,
}: PhotoPreviewProps) {
  const { t } = useTranslation();

  const getQualityIssueText = (issue: QualityIssue): string => {
    switch (issue.type) {
      case 'blur':
        return t('assessment.camera.quality.blur');
      case 'exposure':
        return t('assessment.camera.quality.exposure');
      case 'white_balance':
        return t('assessment.camera.quality.whiteBalance');
      case 'composition':
        return t('assessment.camera.quality.composition');
      default:
        return issue.suggestion || '';
    }
  };

  const styles = StyleSheet.create({
    image: {
      width: '100%',
      height: '70%',
    },
  });

  return (
    <View className="flex-1 bg-charcoal-950">
      <View className="flex-1 items-center justify-center">
        <Image
          source={{ uri: photo.uri }}
          style={styles.image}
          contentFit="contain"
          testID="photo-image"
          accessibilityIgnoresInvertColors
        />
      </View>

      <View className="px-6 pb-8">
        {/* Quality Score */}
        <View className="mb-4 rounded-lg bg-charcoal-900 p-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-semibold text-neutral-100">
              Quality Score
            </Text>
            <Text
              className={`text-lg font-bold ${
                photo.qualityScore.acceptable
                  ? 'text-success-500'
                  : 'text-warning-500'
              }`}
            >
              {Math.round(photo.qualityScore.score)}/100
            </Text>
          </View>

          {/* Quality Issues */}
          {photo.qualityScore.issues.length > 0 && (
            <View className="mt-3 gap-2">
              {photo.qualityScore.issues.map((issue, index) => (
                <View key={index} className="flex-row gap-2">
                  <Text className="text-warning-500">⚠</Text>
                  <Text className="flex-1 text-sm text-neutral-300">
                    {getQualityIssueText(issue)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View className="gap-3">
          <Button
            onPress={onAccept}
            variant="default"
            disabled={!photo.qualityScore.acceptable}
          >
            <Text className="font-semibold text-neutral-100">
              {isLastPhoto
                ? t('assessment.camera.progress.done')
                : t('assessment.camera.progress.next')}
            </Text>
          </Button>

          <Button onPress={onRetake} variant="outline">
            <Text className="font-semibold text-neutral-100">
              {t('assessment.camera.progress.retake')}
            </Text>
          </Button>
        </View>
      </View>
    </View>
  );
}
