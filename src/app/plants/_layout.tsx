import { Stack } from 'expo-router';
import React from 'react';

/**
 * Plants layout - disables default headers
 * Each screen has its own custom header component.
 */
export default function PlantsLayout(): React.ReactElement {
  return <Stack screenOptions={{ headerShown: false }} />;
}
