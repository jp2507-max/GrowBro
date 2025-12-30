import * as React from 'react';

import { Button, Text, View } from '@/components/ui';
import { translate } from '@/lib';

type SessionListHeaderProps = {
  otherSessionsCount: number;
  isRevokingAll: boolean;
  isRevokingSession: boolean;
  onRevokeAll: () => void;
};

export function SessionListHeader({
  otherSessionsCount,
  isRevokingAll,
  isRevokingSession,
  onRevokeAll,
}: SessionListHeaderProps): React.ReactElement {
  return (
    <View className="py-6">
      <Text className="mb-2 text-xl font-bold">
        {translate('auth.sessions.title')}
      </Text>
      <Text className="mb-4 text-neutral-600 dark:text-neutral-400">
        {translate('auth.sessions.description')}
      </Text>

      {otherSessionsCount > 0 && (
        <View className="mb-4">
          <Button
            variant="outline"
            onPress={onRevokeAll}
            label={translate('auth.sessions.revoke_all')}
            disabled={isRevokingAll || isRevokingSession}
            loading={isRevokingAll}
          />
        </View>
      )}
    </View>
  );
}
