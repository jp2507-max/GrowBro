import { Env } from '@env';
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useAuth } from '@/lib/auth';
import {
  configureSync,
  getSyncStatus,
  synchronize,
} from '@/lib/sync/sync-manager';

export function useSync() {
  const status = useAuth.use.status();
  const isConfigured = useRef(false);

  // 1. Configure Sync on Mount
  useEffect(() => {
    if (isConfigured.current) return;

    const apiUrl = Env.API_URL; // e.g. "https://api-dev.example.com"
    if (!apiUrl) {
      console.warn('[useSync] No API_URL found, sync disabled');
      return;
    }

    configureSync({
      pullEndpoint: `${apiUrl}/sync/pull`,
      pushEndpoint: `${apiUrl}/sync/push`,
      batchSize: 1000,
      retryAttempts: 2,
      backoffMultiplier: 2,
      maxBackoffDelay: 30000,
      enableBackgroundSync: true,
      syncOnAppStart: true,
      syncOnForeground: true,
      timeoutMs: 30000,
    });
    isConfigured.current = true;
    console.log('[useSync] Sync configured with API:', apiUrl);
  }, []);

  // 2. Trigger Sync on Auth Success
  useEffect(() => {
    if (status === 'signIn' && isConfigured.current) {
      console.log('[useSync] Auth signed in, triggering initial sync');
      void synchronize().catch((err) => {
        console.error('[useSync] Initial sync failed:', err);
      });
    }
  }, [status]);

  // 3. Trigger Sync on Foreground
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        status === 'signIn' &&
        nextAppState === 'active' &&
        getSyncStatus() !== 'running'
      ) {
        console.log('[useSync] App foregrounded, triggering sync');
        void synchronize().catch((err) => {
          console.warn('[useSync] Foreground sync failed:', err);
        });
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [status]);
}
