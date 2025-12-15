import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Text, View } from '@/components/ui';
import { ArrowLeft } from '@/components/ui/icons';
import { haptics } from '@/lib/haptics';

type FormHeaderProps = {
  title: string;
  onBack: () => void;
  onSave?: () => void;
  saveLabel?: string;
  isSaving?: boolean;
  testID?: string;
};

export function FormHeader({
  title,
  onBack,
  onSave,
  saveLabel,
  isSaving,
  testID = 'form-header',
}: FormHeaderProps): React.ReactElement {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const backLabel = t('accessibility.common.go_back');
  const backHint = t('accessibility.common.return_to_previous');
  const localizedSave = saveLabel ?? t('common.save');
  const saveHint = t('accessibility.common.saves_changes');

  const handleBack = React.useCallback(() => {
    haptics.selection();
    onBack();
  }, [onBack]);

  const handleSave = React.useCallback(() => {
    if (isSaving) return;
    haptics.selection();
    onSave?.();
  }, [isSaving, onSave]);

  return (
    <View
      className="flex-row items-center justify-between border-b border-neutral-200 bg-white px-4 pb-3 dark:border-neutral-800 dark:bg-charcoal-950"
      style={{ paddingTop: insets.top + 8 }}
      testID={testID}
    >
      {/* Back Button */}
      <Button
        onPress={handleBack}
        variant="ghost"
        size="circle"
        className="my-0 bg-transparent active:bg-neutral-100 dark:active:bg-neutral-800"
        accessibilityLabel={backLabel}
        accessibilityHint={backHint}
        testID={`${testID}-back`}
      >
        <ArrowLeft
          width={24}
          height={24}
          className="text-neutral-900 dark:text-white"
        />
      </Button>

      {/* Title */}
      <Text
        className="text-lg font-semibold text-neutral-900 dark:text-white"
        testID={`${testID}-title`}
      >
        {title}
      </Text>

      {/* Save Button */}
      {onSave ? (
        <Button
          onPress={handleSave}
          disabled={isSaving}
          variant="link"
          size="sm"
          className="my-0 rounded-lg px-3 py-2"
          accessibilityLabel={localizedSave}
          accessibilityHint={saveHint}
          testID={`${testID}-save`}
          textClassName={`font-semibold ${
            isSaving
              ? 'text-neutral-400 dark:text-neutral-600'
              : 'text-primary-600 dark:text-primary-400'
          }`}
          label={localizedSave}
        />
      ) : (
        <View className="size-10" />
      )}
    </View>
  );
}
