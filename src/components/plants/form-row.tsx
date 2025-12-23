import React from 'react';

import { Pressable, Text, View } from '@/components/ui';
import { ArrowRight } from '@/components/ui/icons';
import { haptics } from '@/lib/haptics';

type FormRowProps = {
  icon?: string;
  label: string;
  value?: string;
  placeholder?: string;
  onPress?: () => void;
  showArrow?: boolean;
  testID?: string;
};

export function FormRow({
  icon,
  label,
  value,
  placeholder,
  onPress,
  showArrow = true,
  testID = 'form-row',
}: FormRowProps): React.ReactElement {
  const handlePress = React.useCallback(() => {
    haptics.selection();
    onPress?.();
  }, [onPress]);

  const displayValue = value || placeholder;

  const content = (
    <View
      className="flex-row items-center justify-between rounded-xl bg-white px-4 py-3.5 dark:bg-charcoal-900"
      testID={testID}
    >
      <View className="flex-1 flex-row items-center gap-3">
        {icon ? <Text className="text-xl">{icon}</Text> : null}
        <Text className="text-base font-medium text-charcoal-900 dark:text-neutral-100">
          {label}
        </Text>
      </View>

      <View className="flex-row items-center gap-2">
        {displayValue ? (
          <Text
            className="text-base text-neutral-600 dark:text-neutral-400"
            numberOfLines={1}
          >
            {displayValue}
          </Text>
        ) : null}
        {showArrow && onPress ? (
          <ArrowRight
            width={20}
            height={20}
            className="text-neutral-600 dark:text-neutral-400"
          />
        ) : null}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={handlePress}
        className="active:opacity-80"
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${displayValue ?? 'not set'}`}
        accessibilityHint={`Tap to change ${label}`}
      >
        {content}
      </Pressable>
    );
  }

  return content;
}
