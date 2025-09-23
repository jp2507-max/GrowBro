import * as React from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui';
import { PermissionManager } from '@/lib/permissions/permission-manager';

type Props = { onPress?: () => void; testID?: string };

export function NotificationsPermissionBadge({ onPress, testID }: Props) {
  const handlePress = React.useCallback(() => {
    onPress?.();
    // Open settings to let user enable permission
    PermissionManager.provideFallbackExperience('POST_NOTIFICATIONS');
  }, [onPress]);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={handlePress}
      testID={testID ?? 'notif-perm-badge'}
      className="mx-3 my-2"
    >
      <View className="flex-row items-center rounded-md bg-warning-100 px-3 py-2 dark:bg-warning-200">
        <View className="mr-2 size-2 rounded-full bg-warning-500" />
        <Text
          className="text-warning-800 dark:text-warning-900"
          tx="onboarding.notifications_body"
        />
      </View>
    </Pressable>
  );
}

export default NotificationsPermissionBadge;
