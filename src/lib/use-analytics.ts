import * as React from 'react';

import type { AnalyticsClient } from '@/lib/analytics';
import { getAnalyticsClient, subscribe } from '@/lib/analytics-registry';

function getSnapshot(): AnalyticsClient {
  return getAnalyticsClient();
}

export function useAnalytics(): AnalyticsClient {
  return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
