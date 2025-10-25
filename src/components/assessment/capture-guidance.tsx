import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { Text, View } from '@/components/ui';
import type { GuidanceMode } from '@/types/assessment';

type CaptureGuidanceProps = {
  mode: GuidanceMode;
  photoCount: number;
  maxPhotos: number;
};

export function CaptureGuidance({
  mode,
  photoCount,
  maxPhotos,
}: CaptureGuidanceProps): JSX.Element {
  const { t } = useTranslation();

  const getGuidanceText = () => {
    switch (mode) {
      case 'leaf-top':
        return t('assessment.camera.guidance.leafTop');
      case 'leaf-bottom':
        return t('assessment.camera.guidance.leafBottom');
      case 'whole-plant':
        return t('assessment.camera.guidance.wholePlant');
      default:
        return t('assessment.camera.guidance.wholePlant');
    }
  };

  return (
    <View className="absolute inset-x-0 top-0 z-10 bg-charcoal-950/80 px-6 py-4">
      <View className="items-center gap-2">
        <Text className="text-center text-sm font-semibold text-neutral-100">
          {t('assessment.camera.progress.photoCount', {
            current: photoCount + 1,
            total: maxPhotos,
          })}
        </Text>
        <Text className="text-center text-base text-neutral-300">
          {getGuidanceText()}
        </Text>
        <View className="mt-2 flex-row gap-2">
          <Text className="text-xs text-neutral-400">
            • {t('assessment.camera.guidance.lighting')}
          </Text>
        </View>
        <View className="flex-row gap-2">
          <Text className="text-xs text-neutral-400">
            • {t('assessment.camera.guidance.focus')}
          </Text>
        </View>
      </View>
    </View>
  );
}
