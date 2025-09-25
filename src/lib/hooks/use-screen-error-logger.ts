import React from 'react';

import { useNetworkStatus } from '@/lib/hooks/use-network-status';
import { captureCategorizedErrorSync } from '@/lib/sentry-utils';

export type ScreenErrorContext = {
  screen: string;
  feature?: string;
  action?: string;
  queryKey?: string;
  metadata?: Record<string, unknown>;
};

export function useScreenErrorLogger(
  error: unknown,
  context: ScreenErrorContext
): void {
  const network = useNetworkStatus();
  const lastErrorRef = React.useRef<unknown>(null);
  const metadataRef = React.useRef<Record<string, unknown> | undefined>(
    undefined
  );

  const { screen, feature, action, queryKey, metadata } = context;

  React.useEffect(() => {
    metadataRef.current = metadata;
  }, [metadata]);

  React.useEffect(() => {
    if (!error) return;
    if (lastErrorRef.current === error) return;

    lastErrorRef.current = error;

    captureCategorizedErrorSync(error, {
      source: 'screen',
      screen,
      feature: feature ?? screen,
      action: action ?? 'load',
      queryKey,
      isConnected: network.isConnected,
      isInternetReachable: network.isInternetReachable,
      connectionType: network.state?.type ?? 'unknown',
      ...metadataRef.current,
    });
  }, [
    error,
    screen,
    feature,
    action,
    queryKey,
    network.isConnected,
    network.isInternetReachable,
    network.state?.type,
  ]);
}
