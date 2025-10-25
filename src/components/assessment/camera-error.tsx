import { useTranslation } from 'react-i18next';

import { Button, Text, View } from '@/components/ui';
import type { CameraError } from '@/types/assessment';

type CameraErrorProps = {
  error: CameraError;
  onRetry?: () => void;
  onCancel?: () => void;
  onFallbackAction?: {
    retry?: () => void;
    openSettings?: () => void;
    useGallery?: () => void;
    contactSupport?: () => void;
  };
};

export function CameraErrorView({
  error,
  onRetry,
  onCancel,
  onFallbackAction,
}: CameraErrorProps) {
  const { t } = useTranslation();

  const getErrorMessage = () => {
    switch (error.category) {
      case 'capture':
        return t('assessment.camera.errors.captureFailed');
      case 'storage':
        return t('assessment.camera.errors.storageFull');
      case 'hardware':
        return t('assessment.camera.errors.cameraFailed');
      case 'permission':
        return t('assessment.camera.permissionDenied.description');
      default:
        return error.message;
    }
  };

  return (
    <View className="flex-1 items-center justify-center bg-charcoal-950 px-6">
      <View className="items-center gap-4">
        <View className="size-16 items-center justify-center rounded-full bg-danger-500/20">
          <Text className="text-3xl">⚠️</Text>
        </View>

        <Text className="text-center text-xl font-bold text-neutral-100">
          {error.category === 'permission'
            ? t('assessment.camera.permissionDenied.title')
            : t('assessment.camera.errors.title')}
        </Text>

        <Text className="text-center text-base text-neutral-300">
          {getErrorMessage()}
        </Text>

        <View className="mt-6 w-full gap-3">
          {error.retryable && onRetry && (
            <Button onPress={onRetry} variant="default">
              <Text className="font-semibold text-neutral-100">
                {t('assessment.camera.permissionDenied.retry')}
              </Text>
            </Button>
          )}

          {error.fallbackAction && onFallbackAction?.[error.fallbackAction] && (
            <Button
              onPress={() => onFallbackAction[error.fallbackAction]?.()}
              variant="outline"
            >
              <Text className="font-semibold text-neutral-100">
                {t('assessment.camera.useAlternative')}
              </Text>
            </Button>
          )}

          {onCancel && (
            <Button onPress={onCancel} variant="ghost">
              <Text className="font-semibold text-neutral-300">
                {t('common.cancel')}
              </Text>
            </Button>
          )}
        </View>
      </View>
    </View>
  );
}
