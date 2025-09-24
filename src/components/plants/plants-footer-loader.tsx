import React from 'react';

import { ActivityIndicator, View } from '@/components/ui';

type Props = {
  isVisible: boolean;
};

export function PlantsFooterLoader({
  isVisible,
}: Props): React.ReactElement | null {
  if (!isVisible) return null;

  return (
    <View className="py-4" testID="plants-footer-loader">
      <ActivityIndicator size="small" />
    </View>
  );
}
