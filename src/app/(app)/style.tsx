import * as React from 'react';

import { Buttons } from '@/components/buttons';
import { Colors } from '@/components/colors';
import { Inputs } from '@/components/inputs';
import { Typography } from '@/components/typography';
import { FocusAwareStatusBar, ScrollView, View } from '@/components/ui';

export default function Style() {
  return (
    <View className="flex-1 bg-neutral-50 dark:bg-charcoal-950">
      <FocusAwareStatusBar />
      <ScrollView
        className="flex-1 px-4"
        contentInsetAdjustmentBehavior="automatic"
      >
        <Typography />
        <Colors />
        <Buttons />
        <Inputs />
      </ScrollView>
    </View>
  );
}
