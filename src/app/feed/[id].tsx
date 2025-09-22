import { Stack, useLocalSearchParams } from 'expo-router';
import * as React from 'react';

import { usePost } from '@/api';
import { CannabisEducationalBanner } from '@/components/cannabis-educational-banner';
import { ModerationActions } from '@/components/moderation-actions';
import {
  ActivityIndicator,
  FocusAwareStatusBar,
  Text,
  View,
} from '@/components/ui';
import { translate } from '@/lib/i18n';

export default function Post() {
  const local = useLocalSearchParams<{ id: string }>();

  const { data, isPending, isError } = usePost({
    //@ts-ignore
    variables: { id: local.id },
  });

  if (isPending) {
    return (
      <View className="flex-1 justify-center  p-3">
        <Stack.Screen
          options={{
            title: translate('nav.post'),
            headerBackTitle: translate('nav.feed'),
          }}
        />
        <FocusAwareStatusBar />
        <ActivityIndicator />
      </View>
    );
  }
  if (isError) {
    return (
      <View className="flex-1 justify-center p-3">
        <Stack.Screen
          options={{
            title: translate('nav.post'),
            headerBackTitle: translate('nav.feed'),
          }}
        />
        <FocusAwareStatusBar />
        <Text className="text-center">{translate('errors.postLoad')}</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 p-3 ">
      <Stack.Screen
        options={{
          title: translate('nav.post'),
          headerBackTitle: translate('nav.feed'),
        }}
      />
      <FocusAwareStatusBar />
      <CannabisEducationalBanner className="mb-4" />
      <Text className="text-xl">{data.title}</Text>
      <Text>{data.body} </Text>
      <View className="mt-4">
        <ModerationActions contentId={data.id} authorId={data.userId} />
      </View>
    </View>
  );
}
