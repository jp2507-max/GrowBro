/**
 * Cache indicator component for strains list
 * Shows when data is being served from offline cache
 */

import { View } from 'react-native';

import { Text } from '@/components/ui';

interface StrainsCacheIndicatorProps {
  isUsingCache: boolean;
  testID?: string;
}

export function StrainsCacheIndicator({
  isUsingCache,
  testID = 'strains-cache-indicator',
}: StrainsCacheIndicatorProps) {
  if (!isUsingCache) {
    return null;
  }

  return (
    <View
      testID={testID}
      className="mx-4 my-2 rounded border-l-4 border-amber-400 bg-amber-50 p-3"
    >
      <Text className="text-sm font-medium text-amber-800">
        📦 Viewing cached data
      </Text>
      <Text className="mt-1 text-xs text-amber-700">
        Connect to the internet to see the latest strains
      </Text>
    </View>
  );
}
