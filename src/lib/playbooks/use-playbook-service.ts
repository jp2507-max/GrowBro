/**
 * usePlaybookService Hook
 *
 * Provides a configured PlaybookService instance with database and analytics
 */

import * as React from 'react';

import { useAnalytics } from '../use-analytics';
import { database } from '../watermelon';
import { PlaybookService } from './playbook-service';

export function usePlaybookService() {
  const analytics = useAnalytics();

  const service = React.useMemo(() => {
    return new PlaybookService({
      database,
      analytics,
    });
  }, [analytics]);

  return service;
}
