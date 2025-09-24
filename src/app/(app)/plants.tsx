import { useScrollToTop } from '@react-navigation/native';
import React, { useRef } from 'react';
import type { ScrollView } from 'react-native';

import {
  FocusAwareStatusBar,
  ScrollView as RNScrollView,
  Text,
  View,
} from '@/components/ui';

export default function PlantsScreen(): React.ReactElement {
  const scrollRef = useRef<ScrollView | null>(null);
  useScrollToTop(scrollRef);

  return (
    <View className="flex-1" testID="plants-screen">
      <FocusAwareStatusBar />
      <RNScrollView ref={scrollRef} className="p-4">
        <Text className="text-lg font-semibold" tx="tabs.plants" />
      </RNScrollView>
    </View>
  );
}
