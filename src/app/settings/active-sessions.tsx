import { useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as React from 'react';
import { Alert } from 'react-native';

import {
  useRevokeAllOtherSessions,
  useRevokeSession,
  useSessions,
} from '@/api/auth';
import { SessionListItem } from '@/components/auth/session-list-item';
import {
  ActivityIndicator,
  Button,
  FocusAwareStatusBar,
  ScrollView,
  Text,
  View,
} from '@/components/ui';
import { translate, useAuth } from '@/lib';
import { generateStableHash } from '@/lib/auth/utils';

export default function ActiveSessionsScreen() {
  const queryClient = useQueryClient();
  const refreshToken = useAuth((state) => state.token?.refresh ?? null);
  const currentSessionId = React.useMemo(
    () => (refreshToken ? generateStableHash(refreshToken) : null),
    [refreshToken]
  );

  // Fetch sessions
  const { data: sessions, isLoading, error } = useSessions();

  // Revoke session mutation
  const { mutate: revokeSession, isPending: isRevokingSession } =
    useRevokeSession({
      onSuccess: () => {
        // Invalidate sessions query to refresh list
        void queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] });
      },
      onError: (error) => {
        Alert.alert(
          translate('auth.sessions.revoke_error_title'),
          translate('auth.sessions.revoke_error_message')
        );
        console.error('Failed to revoke session:', error);
      },
    });

  // Revoke all other sessions mutation
  const { mutate: revokeAllOtherSessions, isPending: isRevokingAll } =
    useRevokeAllOtherSessions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] });
        Alert.alert(
          translate('auth.sessions.revoke_all_success_title'),
          translate('auth.sessions.revoke_all_success_message')
        );
      },
      onError: (error) => {
        Alert.alert(
          translate('auth.sessions.revoke_all_error_title'),
          translate('auth.sessions.revoke_all_error_message')
        );
        console.error('Failed to revoke all sessions:', error);
      },
    });

  const handleRevokeAll = () => {
    Alert.alert(
      translate('auth.sessions.revoke_all_confirm_title'),
      translate('auth.sessions.revoke_all_confirm_message'),
      [
        {
          text: translate('common.cancel'),
          style: 'cancel',
        },
        {
          text: translate('auth.sessions.revoke_all'),
          style: 'destructive',
          onPress: () => revokeAllOtherSessions(),
        },
      ]
    );
  };

  const handleRevoke = (sessionKey: string) => {
    revokeSession({ sessionKey });
  };

  const otherSessionsCount =
    sessions?.filter((s) =>
      currentSessionId ? s.session_key !== currentSessionId : true
    ).length || 0;

  return (
    <>
      <Stack.Screen
        options={{
          title: translate('auth.sessions.title'),
          headerBackTitle: translate('common.back'),
        }}
      />
      <FocusAwareStatusBar />

      <ScrollView className="flex-1 bg-neutral-50 dark:bg-charcoal-950">
        <View className="px-4 py-6">
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
                onPress={handleRevokeAll}
                label={translate('auth.sessions.revoke_all')}
                disabled={isRevokingAll || isRevokingSession}
                loading={isRevokingAll}
              />
            </View>
          )}

          {isLoading && (
            <View className="py-8">
              <ActivityIndicator size="large" testID="activity-indicator" />
            </View>
          )}

          {error && (
            <View className="rounded-lg bg-danger-100 p-4 dark:bg-danger-900">
              <Text className="text-danger-900 dark:text-danger-100">
                {translate('auth.sessions.error_loading')}
              </Text>
            </View>
          )}

          {!isLoading && !error && sessions && sessions.length === 0 && (
            <View className="rounded-lg bg-white p-4 dark:bg-charcoal-900">
              <Text className="text-neutral-600 dark:text-neutral-400">
                {translate('auth.sessions.no_sessions')}
              </Text>
            </View>
          )}

          {!isLoading && !error && sessions && sessions.length > 0 && (
            <View className="overflow-hidden rounded-lg border border-neutral-200 dark:border-charcoal-700">
              {sessions.map((session) => (
                <SessionListItem
                  key={session.id}
                  session={session}
                  isCurrent={session.session_key === currentSessionId}
                  onRevoke={handleRevoke}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </>
  );
}
