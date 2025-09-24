import { useScrollToTop } from '@react-navigation/native';
import React from 'react';
import { type ScrollView } from 'react-native';

import {
  FocusAwareStatusBar,
  ScrollView as UIScrollView,
  Text,
  View,
} from '@/components/ui';

export default function StrainsScreen(): React.ReactElement {
  const scrollRef = React.useRef<ScrollView | null>(null);
  useScrollToTop(scrollRef);

  return (
    <View className="flex-1" testID="strains-screen">
      <FocusAwareStatusBar />
      <UIScrollView ref={scrollRef} className="p-4">
        <Text className="text-lg font-semibold" tx="tabs.strains" />
      </UIScrollView>
    </View>
  );
}
