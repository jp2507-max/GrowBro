import { Stack } from 'expo-router';
import React from 'react';

export default function ModalsLayout(): React.ReactElement {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="add-post" options={{ presentation: 'modal' }} />
      <Stack.Screen name="date-picker" options={{ presentation: 'modal' }} />
      <Stack.Screen name="harvest" options={{ presentation: 'modal' }} />
      <Stack.Screen
        name="strain-picker"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: [0.65, 1],
          sheetInitialDetentIndex: 0,
          sheetGrabberVisible: true,
          sheetExpandsWhenScrolledToEdge: true,
          contentStyle: { backgroundColor: 'transparent', height: '100%' },
        }}
      />
      <Stack.Screen name="strain/[slug]" options={{ presentation: 'modal' }} />
      <Stack.Screen
        name="trichome-helper"
        options={{ presentation: 'modal' }}
      />
    </Stack>
  );
}
