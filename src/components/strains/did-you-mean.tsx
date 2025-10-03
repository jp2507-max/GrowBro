import * as React from 'react';

import { Pressable, Text, View } from '@/components/ui';
import { translate } from '@/lib';

interface DidYouMeanProps {
  suggestion: string;
  onAccept: (suggestion: string) => void;
  testID?: string;
}

export function DidYouMean({
  suggestion,
  onAccept,
  testID = 'did-you-mean',
}: DidYouMeanProps) {
  const handleAccept = React.useCallback(() => {
    onAccept(suggestion);
  }, [suggestion, onAccept]);

  return (
    <View
      className="dark:bg-primary-950 mb-3 flex-row items-center rounded-lg bg-primary-50 p-3"
      testID={testID}
    >
      <Text className="text-sm text-neutral-700 dark:text-neutral-300">
        {translate('strains.did_you_mean_prefix')}{' '}
      </Text>
      <Pressable
        onPress={handleAccept}
        testID={`${testID}-suggestion`}
        accessibilityRole="button"
        accessibilityLabel={`Did you mean ${suggestion}?`}
        accessibilityHint="Applies suggested search term"
      >
        <Text className="font-semibold text-primary-600 underline dark:text-primary-400">
          {suggestion}
        </Text>
      </Pressable>
      <Text className="text-sm text-neutral-700 dark:text-neutral-300">
        {translate('strains.did_you_mean_suffix')}
      </Text>
    </View>
  );
}
