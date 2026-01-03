import { useQueryClient } from '@tanstack/react-query';
import * as React from 'react';

import { database } from '@/lib/watermelon';

import { getReconnectionHandler } from './reconnection-handler';

export function useCommunitySync(): void {
  const queryClient = useQueryClient();

  React.useEffect(() => {
    const handler = getReconnectionHandler(database, queryClient);
    handler.start();
    return () => {
      handler.stop();
    };
  }, [queryClient]);
}
