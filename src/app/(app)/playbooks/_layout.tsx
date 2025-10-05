/**
 * Playbooks Layout
 *
 * Stack navigator for playbook screens
 */

import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function PlaybooksLayout() {
  const { t } = useTranslation();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackTitle: t('common.back'),
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: t('playbooks.title'),
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          title: t('playbooks.preview'),
        }}
      />
      <Stack.Screen
        name="apply"
        options={{
          title: t('playbooks.apply'),
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="community"
        options={{
          title: t('playbooks.community'),
        }}
      />
    </Stack>
  );
}
