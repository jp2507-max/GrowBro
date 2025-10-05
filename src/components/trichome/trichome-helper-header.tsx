import React from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Text, View } from '@/components/ui';

type TrichomeHelperHeaderProps = {
  onClose?: () => void;
};

export function TrichomeHelperHeader({ onClose }: TrichomeHelperHeaderProps) {
  const { t } = useTranslation();

  return (
    <View className="border-b border-neutral-200 bg-white p-4 dark:border-charcoal-800 dark:bg-charcoal-900">
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <Text className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
            {t('trichome.helper.header')}
          </Text>
          <Text className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {t('trichome.helper.subtitle')}
          </Text>
        </View>
        {onClose && (
          <Button
            variant="ghost"
            size="sm"
            onPress={onClose}
            label="✕"
            className="ml-2"
            testID="close-trichome-helper"
            accessibilityLabel={t('common.cancel')}
            accessibilityHint={t('accessibility.common.go_back')}
          />
        )}
      </View>
    </View>
  );
}
