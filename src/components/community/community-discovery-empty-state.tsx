import * as React from 'react';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

import { Button, Text, View } from '@/components/ui';
import { translate } from '@/lib/i18n';

type CommunityDiscoveryEmptyStateProps = {
  onClearFilters?: () => void;
  testID?: string;
};

export function CommunityDiscoveryEmptyState({
  onClearFilters,
  testID = 'community-discovery-empty-state',
}: CommunityDiscoveryEmptyStateProps): React.ReactElement {
  return (
    <Animated.View
      entering={FadeIn.springify().reduceMotion(ReduceMotion.System)}
    >
      <View
        testID={testID}
        className="flex-1 items-center justify-center gap-4 px-6 py-12"
      >
        <Text className="text-center text-lg font-semibold text-charcoal-900 dark:text-neutral-100">
          {translate('community.discovery_empty_title')}
        </Text>
        <Text className="text-center text-sm text-neutral-600 dark:text-neutral-400">
          {translate('community.discovery_empty_body')}
        </Text>
        {onClearFilters && (
          <Button
            variant="outline"
            label={translate('community.clear_filters')}
            onPress={onClearFilters}
            testID={`${testID}-clear`}
          />
        )}
      </View>
    </Animated.View>
  );
}
