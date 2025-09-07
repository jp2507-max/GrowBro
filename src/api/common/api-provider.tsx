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

export const queryClient = new QueryClient();

export function APIProvider({ children }: { children: React.ReactNode }) {
  useReactQueryDevTools(queryClient);
  // Wire online status so queries auto-refetch on reconnect
  React.useEffect(() => {
    const remove = onlineManager.setEventListener((setOnline) =>
      NetInfo.addEventListener((state) => {
        // treat unknown reachability as connected to let Query handle retries
        const isConnected = !!state.isConnected;
        setOnline(isConnected);
      })
    );
    return () => {
      try {
        (remove as any)?.();
      } catch {}
    };
  }, []);

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
