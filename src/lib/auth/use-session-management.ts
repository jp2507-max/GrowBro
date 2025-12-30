import { useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { Alert } from 'react-native';

import {
  useRevokeAllOtherSessions,
  useRevokeSession,
  type UserSession,
  useSessions,
} from '@/api/auth';
import { translate, useAuth } from '@/lib';
import { generateStableHash } from '@/lib/auth/utils';

type UseSessionManagementReturn = {
  sessions: UserSession[] | undefined;
  isLoading: boolean;
  error: Error | null;
  currentSessionId: string | null;
  isRevokingSession: boolean;
  isRevokingAll: boolean;
  otherSessionsCount: number;
  handleRevokeAll: () => void;
  handleRevoke: (sessionKey: string) => void;
};

/**
 * Custom hook that encapsulates all session management logic for ActiveSessionsScreen.
 * Extracts mutation handlers and state to reduce component complexity.
 */
export function useSessionManagement(): UseSessionManagementReturn {
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
        void queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] });
      },
      onError: (revokeError) => {
        Alert.alert(
          translate('auth.sessions.revoke_error_title'),
          translate('auth.sessions.revoke_error_message')
        );
        console.error('Failed to revoke session:', revokeError);
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
      onError: (revokeAllError) => {
        Alert.alert(
          translate('auth.sessions.revoke_all_error_title'),
          translate('auth.sessions.revoke_all_error_message')
        );
        console.error('Failed to revoke all sessions:', revokeAllError);
      },
    });

  const handleRevokeAll = React.useCallback(() => {
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
  }, [revokeAllOtherSessions]);

  const handleRevoke = React.useCallback(
    (sessionKey: string) => revokeSession({ sessionKey }),
    [revokeSession]
  );

  const otherSessionsCount = React.useMemo(
    () =>
      sessions?.filter((s) =>
        currentSessionId ? s.session_key !== currentSessionId : true
      ).length || 0,
    [sessions, currentSessionId]
  );

  return {
    sessions,
    isLoading,
    error,
    currentSessionId,
    isRevokingSession,
    isRevokingAll,
    otherSessionsCount,
    handleRevokeAll,
    handleRevoke,
  };
}
