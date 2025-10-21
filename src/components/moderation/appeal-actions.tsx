import React from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Text, View } from '@/components/ui';

type AppealActionsProps = {
  isSubmitting: boolean;
  counterArgumentsLength: number;
  onCancel: () => void;
  onSubmit: () => void;
};

export function AppealActions({
  isSubmitting,
  counterArgumentsLength,
  onCancel,
  onSubmit,
}: AppealActionsProps) {
  const { t } = useTranslation();

  return (
    <View className="flex-row gap-3">
      <Button
        variant="outline"
        onPress={onCancel}
        disabled={isSubmitting}
        className="flex-1"
      >
        <Text>{t('common.cancel')}</Text>
      </Button>
      <Button
        variant="default"
        onPress={onSubmit}
        disabled={isSubmitting || counterArgumentsLength < 50}
        className="flex-1"
      >
        <Text>
          {isSubmitting ? t('common.submitting') : t('appeals.action.submit')}
        </Text>
      </Button>
    </View>
  );
}
