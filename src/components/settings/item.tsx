import * as React from 'react';

import { Pressable, Text, View } from '@/components/ui';
import { ArrowRight } from '@/components/ui/icons';
import type { TxKeyPath } from '@/lib';

type ItemProps = {
  text: TxKeyPath;
  value?: string;
  onPress?: () => void;
  icon?: React.ReactNode;
  rightElement?: React.ReactNode;
  disabled?: boolean;
};

export const Item = ({
  text,
  value,
  icon,
  onPress,
  rightElement,
  disabled = false,
}: ItemProps) => {
  const isPressable = onPress !== undefined && !disabled;
  return (
    <Pressable
      onPress={onPress}
      pointerEvents={isPressable ? 'auto' : 'none'}
      className="flex-1 flex-row items-center justify-between px-4 py-2"
      accessibilityRole={isPressable ? 'button' : undefined}
      accessibilityState={{ disabled: !isPressable }}
      disabled={disabled}
    >
      <View className="flex-row items-center">
        {icon && <View className="pr-2">{icon}</View>}
        <Text tx={text} className={disabled ? 'opacity-50' : undefined} />
      </View>
      <View className="flex-row items-center gap-2">
        {rightElement}
        <Text className="text-neutral-600 dark:text-white">{value}</Text>
        {isPressable && (
          <View className="pl-2">
            <ArrowRight />
          </View>
        )}
      </View>
    </Pressable>
  );
};
