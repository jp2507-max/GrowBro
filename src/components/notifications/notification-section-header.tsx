import React from 'react';

import { Text, View } from '@/components/ui';

type Props = {
  readonly label: string;
};

export function NotificationSectionHeader({
  label,
}: Props): React.ReactElement {
  return (
    <View className="px-4 pt-6" testID="notifications-section-header">
      <Text className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {label}
      </Text>
    </View>
  );
}
