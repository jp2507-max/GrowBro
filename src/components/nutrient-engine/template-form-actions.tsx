/**
 * Template Form Actions Component
 *
 * Cancel and submit buttons for feeding template form
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

import { Button, View } from '@/components/ui';

type TemplateFormActionsProps = {
  onCancel: () => void;
  onSubmit: () => void;
  isValid: boolean;
  testID: string;
};

export function TemplateFormActions({
  onCancel,
  onSubmit,
  isValid,
  testID,
}: TemplateFormActionsProps): React.ReactElement {
  const { t } = useTranslation();

  return (
    <View className="mt-4 flex-row gap-3 border-t border-neutral-200 pt-4 dark:border-neutral-700">
      <Button
        label={t('common.cancel')}
        onPress={onCancel}
        variant="outline"
        className="flex-1"
        testID={`${testID}-cancel`}
      />
      <Button
        label={t('common.save')}
        onPress={onSubmit}
        disabled={!isValid}
        className="flex-1"
        testID={`${testID}-submit`}
      />
    </View>
  );
}
