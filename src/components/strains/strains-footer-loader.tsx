import React from 'react';

import { ActivityIndicator, View } from '@/components/ui';

type Props = {
  isVisible: boolean;
};

export function StrainsFooterLoader({
  isVisible,
}: Props): React.ReactElement | null {
  if (!isVisible) return null;

  return (
    <View className="py-6" testID="strains-footer-loader">
      <ActivityIndicator />
    </View>
  );
}
