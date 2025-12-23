import { DateTime } from 'luxon';
import * as React from 'react';
import { Alert } from 'react-native';

import type { UserSession } from '@/api/auth';
import { Button, Pressable, Text, View } from '@/components/ui';
import { translate } from '@/lib';

interface SessionListItemProps {
  session: UserSession;
  isCurrent: boolean;
  onRevoke: (sessionKey: string) => void;
}

export function SessionListItem({
  session,
  isCurrent,
  onRevoke,
}: SessionListItemProps) {
  const handleRevoke = () => {
    Alert.alert(
      translate('auth.sessions.revoke_confirm_title'),
      translate('auth.sessions.revoke_confirm_message', {
        device: session.device_name,
      }),
      [
        {
          text: translate('common.cancel'),
          style: 'cancel',
        },
        {
          text: translate('auth.sessions.revoke'),
          style: 'destructive',
          onPress: () => onRevoke(session.session_key),
        },
      ]
    );
  };

  const formatLastActive = (timestamp: string) => {
    const dt = DateTime.fromISO(timestamp);
    const now = DateTime.now();
    const diff = now.diff(dt, ['days', 'hours', 'minutes']).toObject();

    if (diff.days && diff.days >= 1) {
      return translate('auth.sessions.last_active_days', {
        count: Math.floor(diff.days),
      });
    } else if (diff.hours && diff.hours >= 1) {
      return translate('auth.sessions.last_active_hours', {
        count: Math.floor(diff.hours),
      });
    } else {
      return translate('auth.sessions.last_active_minutes', {
        count: Math.floor(diff.minutes || 0),
      });
    }
  };

  return (
    <Pressable
      className="border-b border-neutral-200 px-4 py-3 dark:border-charcoal-700"
      disabled={isCurrent}
      accessibilityRole="none"
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <View className="flex-row items-center">
            <Text className="font-semibold">{session.device_name}</Text>
            {isCurrent && (
              <View className="ml-2 rounded-full bg-primary-600 px-2 py-0.5">
                <Text className="text-xs text-white">
                  {translate('auth.sessions.current')}
                </Text>
              </View>
            )}
          </View>

          <Text className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {session.device_os} • {session.app_version}
          </Text>

          <Text className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
            {formatLastActive(session.last_active_at)}
          </Text>

          {session.ip_address_truncated && (
            <Text className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              {translate('auth.sessions.ip_address', {
                ip: session.ip_address_truncated,
              })}
            </Text>
          )}
        </View>

        {!isCurrent && (
          <Button
            variant="outline"
            size="sm"
            onPress={handleRevoke}
            label={translate('auth.sessions.revoke')}
            accessibilityLabel={translate('auth.sessions.revoke_hint', {
              device: session.device_name,
            })}
            accessibilityHint={translate('auth.sessions.revoke_dialog_hint')}
          />
        )}
      </View>
    </Pressable>
  );
}
