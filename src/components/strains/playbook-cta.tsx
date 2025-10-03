import * as React from 'react';

import type { Strain } from '@/api';
import { Pressable, Text, View } from '@/components/ui';
import { translate } from '@/lib';

type Props = {
  strain: Strain;
  testID?: string;
};

export const PlaybookCTA = React.memo<Props>(({ strain, testID }) => {
  const handlePress = React.useCallback(() => {
    // TODO: Navigate to playbook creation with preselected options
    // This will be implemented when the playbook feature is ready
    // For now, this is a placeholder
    console.log('Navigate to playbook with strain:', strain.id);
  }, [strain.id]);

  return (
    <View className="mx-4 mb-4" testID={testID}>
      <Pressable
        onPress={handlePress}
        className="rounded-2xl bg-primary-600 p-4"
        accessibilityRole="button"
        accessibilityLabel={translate('strains.detail.use_in_playbook')}
        accessibilityHint={translate('accessibility.strains.playbook_cta_hint')}
      >
        <Text className="mb-1 text-center text-base font-semibold text-white">
          {translate('strains.detail.use_in_playbook')}
        </Text>
        <Text className="text-center text-xs text-primary-100">
          {translate('strains.detail.playbook_description')}
        </Text>
      </Pressable>
    </View>
  );
});

PlaybookCTA.displayName = 'PlaybookCTA';
