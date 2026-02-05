import React from 'react';
import { View } from 'react-native';

import { Text } from './text';

type SectionHeaderProps = {
  title: string;
};

export const SectionHeader = ({ title }: SectionHeaderProps) => (
  <View className="mb-3 flex-row items-center gap-2">
    <View className="h-5 w-1 rounded-full bg-neon-lime shadow-[0_0_8px_#94fa2e]" />
    <Text className="text-xl font-bold text-neutral-900 dark:text-white">
      {title}
    </Text>
  </View>
);
