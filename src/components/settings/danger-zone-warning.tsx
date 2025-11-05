import * as React from 'react';

import { Text, View } from '@/components/ui';
import { translate } from '@/lib';

export function DangerZoneWarning() {
  return (
    <View className="mt-4 rounded-lg bg-warning-100 p-4 dark:bg-warning-900">
      <Text className="text-sm text-warning-900 dark:text-warning-100">
        {translate('auth.security.danger_zone_warning')}
      </Text>
    </View>
  );
}
