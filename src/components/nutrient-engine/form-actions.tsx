/**
 * Form Actions Component
 *
 * Cancel and submit buttons for the pH/EC input form
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

import { Button, View } from '@/components/ui';

type FormActionsProps = {
  onCancel: () => void;
  onSubmit: () => void;
  isValid: boolean;
  testID: string;
};

export function FormActions({
  onCancel,
  onSubmit,
  isValid,
  testID,
}: FormActionsProps): React.ReactElement {
  const { t } = useTranslation();

  return (
    <View className="mt-6 flex-row gap-3">
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
