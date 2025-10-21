/**
 * Moderator Layout
 * Protected layout for moderator-only routes with auth guard
 * Requirements: 2.1, 10.1
 */

import { Redirect, Stack } from 'expo-router';
import React from 'react';

import { useIsModerator } from '@/lib/auth/use-is-moderator';

export default function ModeratorLayout() {
  const isModerator = useIsModerator();

  if (!isModerator) {
    return <Redirect href="/feed" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackTitle: 'Back',
        headerTintColor: '#059669',
      }}
    >
      <Stack.Screen
        name="queue/index"
        options={{
          title: 'Moderation Queue',
        }}
      />
      <Stack.Screen
        name="report/[id]"
        options={{
          title: 'Review Report',
        }}
      />
    </Stack>
  );
}
