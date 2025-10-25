import { useTranslation } from 'react-i18next';
import { Linking, Platform } from 'react-native';

import { Button, Text, View } from '@/components/ui';

type PermissionDeniedProps = {
  onRetry?: () => void;
  onCancel?: () => void;
};

export function PermissionDenied({ onRetry, onCancel }: PermissionDeniedProps) {
  const { t } = useTranslation();

  const openSettings = async () => {
    if (Platform.OS === 'ios') {
      await Linking.openURL('app-settings:');
    } else {
      await Linking.openSettings();
    }
  };

  return (
    <View className="flex-1 items-center justify-center bg-charcoal-950 px-6">
      <View className="items-center gap-4">
        <Text className="text-center text-2xl font-bold text-neutral-100">
          {t('assessment.camera.permissionDenied.title')}
        </Text>
        <Text className="text-center text-base text-neutral-300">
          {t('assessment.camera.permissionDenied.description')}
        </Text>

        <View className="mt-6 w-full gap-3">
          <Button onPress={openSettings} variant="default">
            <Text className="font-semibold text-neutral-100">
              {t('assessment.camera.permissionDenied.openSettings')}
            </Text>
          </Button>

          {onRetry && (
            <Button onPress={onRetry} variant="outline">
              <Text className="font-semibold text-neutral-100">
                {t('assessment.camera.permissionDenied.retry')}
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
