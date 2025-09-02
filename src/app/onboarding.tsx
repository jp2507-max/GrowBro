import { useRouter } from 'expo-router';
import React from 'react';

import { Cover } from '@/components/cover';
import {
  Button,
  FocusAwareStatusBar,
  SafeAreaView,
  Text,
  View,
} from '@/components/ui';
import { useIsFirstTime } from '@/lib/hooks';
import { translate } from '@/lib/i18n';
import { TaskNotificationService } from '@/lib/task-notifications';
export default function Onboarding() {
  const [, setIsFirstTime] = useIsFirstTime();
  const router = useRouter();
  const [isRequesting, setIsRequesting] = React.useState(false);
  const requestNotifications = React.useCallback(async () => {
    setIsRequesting(true);
    try {
      const svc = new TaskNotificationService();
      await svc.requestPermissions();
    } finally {
      setIsRequesting(false);
    }
  }, []);
  return (
    <View className="flex h-full items-center  justify-center">
      <FocusAwareStatusBar />
      <View className="w-full flex-1">
        <Cover />
      </View>
      <View className="justify-end ">
        <Text className="my-3 text-center text-5xl font-bold">
          {translate('onboarding.notifications_title')}
        </Text>
        <Text className="mb-2 text-center text-lg text-gray-600">
          {translate('onboarding.notifications_body')}
        </Text>

        <Text className="my-1 pt-6 text-left text-lg">
          🚀 Production-ready{' '}
        </Text>
        <Text className="my-1 text-left text-lg">
          🥷 Developer experience + Productivity
        </Text>
        <Text className="my-1 text-left text-lg">
          🧩 Minimal code and dependencies
        </Text>
        <Text className="my-1 text-left text-lg">
          💪 well maintained third-party libraries
        </Text>
      </View>
      <SafeAreaView className="mt-6 w-full px-6">
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Button
              label={translate('onboarding.allow_button')}
              onPress={requestNotifications}
              loading={isRequesting}
              testID="onboarding-allow-notifications"
            />
          </View>
          <View className="flex-1">
            <Button
              variant="outline"
              label={translate('onboarding.continue_button')}
              onPress={() => {
                setIsFirstTime(false);
                router.replace('/login');
              }}
              testID="onboarding-continue"
            />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}
