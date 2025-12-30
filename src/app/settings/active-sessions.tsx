import { Stack } from 'expo-router';
import * as React from 'react';

import type { UserSession } from '@/api/auth';
import { SessionListItem } from '@/components/auth/session-list-item';
import { SessionEmptyState } from '@/components/settings/session-empty-state';
import { SessionListHeader } from '@/components/settings/session-list-header';
import { FocusAwareStatusBar, List, View } from '@/components/ui';
import { translate } from '@/lib';
import { useSessionManagement } from '@/lib/auth/use-session-management';

// -----------------------------------------------------------------------------
// List item types
// -----------------------------------------------------------------------------

type SessionItem = {
  type: 'session';
  session: UserSession;
  isCurrent: boolean;
};

type ActiveSessionListItem = SessionItem;

// -----------------------------------------------------------------------------
// Main Screen Component
// -----------------------------------------------------------------------------

export default function ActiveSessionsScreen(): React.ReactElement {
  const {
    sessions,
    isLoading,
    error,
    currentSessionId,
    isRevokingSession,
    isRevokingAll,
    otherSessionsCount,
    handleRevokeAll,
    handleRevoke,
  } = useSessionManagement();

  // Build list data
  const listData = React.useMemo((): ActiveSessionListItem[] => {
    if (!sessions || sessions.length === 0) return [];

    return sessions.map((session) => ({
      type: 'session' as const,
      session,
      isCurrent: session.session_key === currentSessionId,
    }));
  }, [sessions, currentSessionId]);

  const renderItem = React.useCallback(
    ({ item }: { item: ActiveSessionListItem }): React.ReactElement | null => {
      return (
        <SessionListItem
          session={item.session}
          isCurrent={item.isCurrent}
          onRevoke={handleRevoke}
        />
      );
    },
    [handleRevoke]
  );

  const keyExtractor = React.useCallback(
    (item: ActiveSessionListItem): string => {
      return `session-${item.session.id}`;
    },
    []
  );

  const ListHeaderComponent = React.useMemo(
    () => (
      <SessionListHeader
        otherSessionsCount={otherSessionsCount}
        isRevokingAll={isRevokingAll}
        isRevokingSession={isRevokingSession}
        onRevokeAll={handleRevokeAll}
      />
    ),
    [otherSessionsCount, isRevokingAll, isRevokingSession, handleRevokeAll]
  );

  const ListEmptyComponent = React.useMemo(
    () => <SessionEmptyState isLoading={isLoading} error={error} />,
    [isLoading, error]
  );

  const contentContainerStyle = React.useMemo(
    () => ({
      paddingHorizontal: 16,
    }),
    []
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: translate('auth.sessions.title'),
          headerBackTitle: translate('common.back'),
        }}
      />
      <FocusAwareStatusBar />

      <View className="flex-1 bg-neutral-50 dark:bg-charcoal-950">
        {sessions && sessions.length > 0 ? (
          <View className="mx-4 mt-4 overflow-hidden rounded-lg border border-neutral-200 dark:border-charcoal-700">
            <List
              data={listData}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              ListHeaderComponent={ListHeaderComponent}
              ListEmptyComponent={ListEmptyComponent}
              contentContainerStyle={contentContainerStyle}
              contentInsetAdjustmentBehavior="automatic"
              showsVerticalScrollIndicator={false}
            />
          </View>
        ) : (
          <View className="px-4">
            {ListHeaderComponent}
            {ListEmptyComponent}
          </View>
        )}
      </View>
    </>
  );
}
