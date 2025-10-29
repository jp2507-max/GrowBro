import { createMutation, createQuery } from 'react-query-kit';

import { supabase } from '@/lib/supabase';

// Session from user_sessions table
export interface UserSession {
  id: string;
  user_id: string;
  session_key: string;
  device_name: string;
  device_os: string;
  app_version: string;
  ip_address_truncated: string;
  last_active_at: string;
  created_at: string;
  revoked_at: string | null;
}

// Fetch active sessions for current user
export const useSessions = createQuery<UserSession[], void, Error>({
  queryKey: ['auth', 'sessions'],
  fetcher: async () => {
    const { data, error } = await supabase
      .from('user_sessions')
      .select('*')
      .is('revoked_at', null)
      .order('last_active_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data as UserSession[];
  },
});

// Revoke a specific session (via Edge Function)
export const useRevokeSession = createMutation<
  void,
  { sessionKey: string },
  Error
>({
  mutationFn: async ({ sessionKey }) => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      throw new Error('No active session');
    }

    // Call Edge Function via Supabase functions.invoke
    const { error } = await supabase.functions.invoke('revoke-session', {
      body: { session_key: sessionKey },
    });

    if (error) {
      throw new Error(error.message || 'Failed to revoke session');
    }
  },
});

// Revoke all other sessions (via Edge Function)
export const useRevokeAllOtherSessions = createMutation<void, void, Error>({
  mutationFn: async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      throw new Error('No active session');
    }

    // Call Edge Function via Supabase functions.invoke
    const { error } = await supabase.functions.invoke('revoke-all-sessions', {
      body: {},
    });

    if (error) {
      throw new Error(error.message || 'Failed to revoke all sessions');
    }
  },
});
