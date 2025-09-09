/* eslint-disable no-flatlist/no-flatlist */
// Test file to verify FlatList detection rule
import { FlashList } from '@shopify/flash-list';
import { FlatList, View } from 'react-native';

export function TestComponent() {
  return (
    <View>
      {/* This should trigger the no-flatlist rule */}
      <FlatList data={[]} renderItem={() => null} />

      {/* This should NOT trigger the rule */}
      <FlashList data={[]} renderItem={() => null} />
    </View>
  );
}
