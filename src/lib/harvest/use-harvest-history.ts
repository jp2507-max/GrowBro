import type { Collection } from '@nozbe/watermelondb';
import { Q } from '@nozbe/watermelondb';
import React from 'react';

import { useNetworkStatus } from '@/lib/hooks';
import { database } from '@/lib/watermelon';
import type { HarvestModel } from '@/lib/watermelon-models/harvest';
import type { Harvest } from '@/types/harvest';
import { HarvestStage } from '@/types/harvest';

export type HarvestHistoryFilters = {
  readonly plantId?: string;
  readonly status?: 'all' | 'active' | 'completed';
  readonly query?: string;
};

const STATUS_FILTERS: Record<
  NonNullable<HarvestHistoryFilters['status']>,
  (harvest: HarvestModel) => boolean
> = {
  all: () => true,
  active: (harvest) => harvest.stage !== HarvestStage.INVENTORY,
  completed: (harvest) => harvest.stage === HarvestStage.INVENTORY,
};

export function useHarvestHistory(initialFilters?: HarvestHistoryFilters) {
  const { isConnected } = useNetworkStatus();
  const [filtersState, setFiltersState] = React.useState<HarvestHistoryFilters>(
    {
      status: 'all',
      ...initialFilters,
    }
  );
  const [isLoading, setLoading] = React.useState<boolean>(true);
  const [harvests, setHarvests] = React.useState<Harvest[]>([]);

  React.useEffect(() => {
    const unsubscribe = startObservation(filtersState, setHarvests, setLoading);
    return () => unsubscribe();
  }, [filtersState]);

  const setFilters = React.useCallback(
    (
      updater:
        | HarvestHistoryFilters
        | ((prev: HarvestHistoryFilters) => HarvestHistoryFilters)
    ) => {
      setFiltersState((prev) =>
        typeof updater === 'function' ? updater(prev) : { ...prev, ...updater }
      );
      setLoading(true);
    },
    []
  );

  const clearFilters = React.useCallback(() => {
    setFiltersState((prev) => ({
      plantId: prev.plantId,
      status: 'all',
      query: undefined,
    }));
    setLoading(true);
  }, []);

  return {
    harvests,
    filters: filtersState,
    setFilters,
    clearFilters,
    isOffline: !isConnected,
    isLoading,
  };
}

function filterByQuery(records: HarvestModel[], query: string): HarvestModel[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return records;

  return records.filter((record) => {
    const haystack = `${record.notes ?? ''}`.toLowerCase();
    return haystack.includes(normalized);
  });
}

function mapModelToHarvest(model: HarvestModel): Harvest {
  return {
    id: model.id,
    plant_id: model.plantId,
    user_id: model.userId ?? '',
    stage: model.stage,
    wet_weight_g: model.wetWeightG ?? null,
    dry_weight_g: model.dryWeightG ?? null,
    trimmings_weight_g: model.trimmingsWeightG ?? null,
    notes: model.notes,
    stage_started_at: model.stageStartedAt,
    stage_completed_at: model.stageCompletedAt ?? null,
    photos: model.photos.map((photo) => photo.localUri),
    created_at: model.createdAt,
    updated_at: model.updatedAt,
    deleted_at: model.deletedAt ?? null,
    conflict_seen: model.conflictSeen,
    server_revision: model.serverRevision,
    server_updated_at_ms: model.serverUpdatedAtMs,
  };
}

function startObservation(
  filtersState: HarvestHistoryFilters,
  setHarvests: React.Dispatch<React.SetStateAction<Harvest[]>>,
  setLoading: React.Dispatch<React.SetStateAction<boolean>>
) {
  const collection: Collection<HarvestModel> = database.get('harvests');

  const clauses = [Q.where('deleted_at', null)] as ReturnType<typeof Q.where>[];
  if (filtersState.plantId) {
    clauses.push(Q.where('plant_id', filtersState.plantId));
  }

  const query = collection.query(...clauses, Q.sortBy('updated_at', Q.desc));

  const subscription = query.observe().subscribe({
    next: (records) => {
      const statusKey = filtersState.status ?? 'all';
      const filteredStatus = records.filter((record) =>
        STATUS_FILTERS[statusKey](record)
      );
      const filteredQuery = filtersState.query
        ? filterByQuery(filteredStatus, filtersState.query)
        : filteredStatus;

      setHarvests(filteredQuery.map(mapModelToHarvest));
      setLoading(false);
    },
    error: (error) => {
      console.error('[useHarvestHistory] observe failed', error);
      setHarvests([]);
      setLoading(false);
    },
  });

  return () => subscription.unsubscribe();
}
