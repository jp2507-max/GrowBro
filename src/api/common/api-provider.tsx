import { useReactQueryDevTools } from '@dev-plugins/react-query';
import NetInfo from '@react-native-community/netinfo';
import {
  focusManager,
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import * as React from 'react';
import { AppState, Platform } from 'react-native';

/**
 * React Query configuration for GrowBro
 *
 * ARCHITECTURE DECISION:
 * - React Query is used for SERVER STATE (reads/caches) only
 * - WatermelonDB handles ALL WRITES via sync engine
 * - Mutations are NOT persisted in React Query (by design)
 * - This ensures offline-first with WatermelonDB as single source of truth
 *
 * DO NOT:
 * - Persist mutations using persistQueryClient or similar
 * - Call resumePausedMutations() on app start
 * - Use React Query mutations for data writes (use WatermelonDB collections)
 *
 * @see src/lib/sync-engine.ts for write operations
 * @see src/lib/watermelon for database models
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Reasonable defaults for read caching
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: 2,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: {
      // IMPORTANT: Mutations should NOT be used for data writes
      // This is a safeguard - use WatermelonDB collections instead
      retry: false,
      onError: (error) => {
        if (__DEV__) {
          console.warn(
            '⚠️ React Query mutation detected. Use WatermelonDB for writes instead.',
            error
          );
        }
      },
    },
  },
});

// Wire online status so queries auto-refetch on reconnect
onlineManager.setEventListener((setOnline) => {
  return NetInfo.addEventListener((state) => {
    // treat unknown reachability as connected to let Query handle retries
    const isConnected = state.isConnected ?? true;
    setOnline(isConnected);
  });
});

export function APIProvider({ children }: { children: React.ReactNode }) {
  useReactQueryDevTools(queryClient);

  // Wire focus so queries refetch when app returns to foreground
  React.useEffect(() => {
    const sub = AppState.addEventListener('change', (status) => {
      if (Platform.OS !== 'web') {
        focusManager.setFocused(status === 'active');
      }
    });
    return () => {
      try {
        sub.remove();
      } catch {}
    };
  }, []);
  return (
    // Provide the client to your App
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
