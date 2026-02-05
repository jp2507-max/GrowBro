import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

type SheetHeaderProps = {
  /** The title of the sheet */
  title: string;
  /** Callback when cancel/close is pressed */
  onCancel: () => void;
  /** Custom label for the cancel button */
  cancelLabel?: string;
  /** Optional element to render on the right to balance the header or provide action */
  rightElement?: React.ReactNode;
  /** Optional class name for the container */
  className?: string;
};

/**
 * Standard header for Sheets/Modals with Cancel button, centered Title, and optional Right element.
 * Follows the pattern: [Cancel] [Title] [RightElement/Spacer]
 */
export function SheetHeader({
  title,
  onCancel,
  cancelLabel,
  rightElement,
  className,
}: SheetHeaderProps): React.ReactElement {
  const { t } = useTranslation();
  const label = cancelLabel ?? t('common.cancel');

  return (
    <View
      className={cn(
        'mb-4 flex-row items-center justify-between px-4',
        className
      )}
    >
      <Pressable
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={t('accessibility.modal.close_hint')}
        hitSlop={20}
      >
        <Text className="text-base font-medium text-primary-600 dark:text-primary-400">
          {label}
        </Text>
      </Pressable>

      <Text className="text-base font-semibold text-charcoal-800 dark:text-neutral-100">
        {title}
      </Text>

      <View className="w-[64px] items-end">{rightElement}</View>
    </View>
  );
}
