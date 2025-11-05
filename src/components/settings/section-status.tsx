/**
 * SectionStatus component
 *
 * Displays inline status preview for settings sections
 * Requirements: 2.5, 3.1, 4.1, 5.2, 11.1
 */

import React from 'react';

import { Text, View } from '../ui';

interface SectionStatusProps {
  label: string;
  testID?: string;
}

export function SectionStatus({
  label,
  testID = 'section-status',
}: SectionStatusProps): React.ReactElement {
  return (
    <View testID={testID}>
      <Text className="text-sm text-neutral-500 dark:text-neutral-400">
        {label}
      </Text>
    </View>
  );
}
