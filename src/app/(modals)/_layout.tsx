import { Stack } from 'expo-router';
import React from 'react';

export default function ModalsLayout(): React.ReactElement {
  return (
    <Stack
      screenOptions={{
        presentation: 'modal',
      }}
    />
  );
}
