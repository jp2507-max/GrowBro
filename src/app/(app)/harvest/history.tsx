import React from 'react';

import { HarvestHistoryList } from '@/components/harvest/harvest-history-list';
import { useHarvestHistory } from '@/lib/harvest/use-harvest-history';

export default function HarvestHistoryScreen(): React.ReactElement {
  const { harvests, isOffline, isLoading } = useHarvestHistory();

  return (
    <HarvestHistoryList
      harvests={harvests}
      isOffline={isOffline}
      isLoading={isLoading}
    />
  );
}
