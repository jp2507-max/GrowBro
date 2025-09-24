import { useScrollToTop } from '@react-navigation/native';
import React from 'react';

import { FocusAwareStatusBar, ScrollView, Text, View } from '@/components/ui';

export default function StrainsScreen(): React.ReactElement {
  const scrollRef = React.useRef(null);
  useScrollToTop(scrollRef);

  return (
    <View className="flex-1" testID="strains-screen">
      <FocusAwareStatusBar />
      <ScrollView ref={scrollRef as any} className="p-4">
        <Text className="text-lg font-semibold" tx="tabs.strains" />
      </ScrollView>
    </View>
  );
}
