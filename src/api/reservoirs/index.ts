import { useQuery } from '@tanstack/react-query';
import type { AxiosError } from 'axios';

import {
  type GrowingMedium,
  type PpmScale,
  type Reservoir,
} from '@/lib/nutrient-engine/types';
import { database } from '@/lib/watermelon';
import type { ReservoirModel } from '@/lib/watermelon-models/reservoir';

// ============================================================================
// Types
// ============================================================================

type FetchReservoirsResponse = {
  data: Reservoir[];
  total: number;
};

// ============================================================================
// Local Database Operations
// ============================================================================

export async function fetchReservoirsLocal(): Promise<FetchReservoirsResponse> {
  const reservoirsCollection = database.get<ReservoirModel>('reservoirs_v2');

  const records = await reservoirsCollection.query().fetch();
  const total = await reservoirsCollection.query().fetchCount();

  const data: Reservoir[] = records.map((record) => ({
    id: record.id,
    name: record.name,
    volumeL: record.volumeL,
    medium: record.medium as GrowingMedium,
    targetPhMin: record.targetPhMin,
    targetPhMax: record.targetPhMax,
    targetEcMin25c: record.targetEcMin25c,
    targetEcMax25c: record.targetEcMax25c,
    ppmScale: record.ppmScale as PpmScale,
    sourceWaterProfileId: record.sourceWaterProfileId,
    playbookBinding: record.playbookBinding,
    createdAt: record.createdAt.getTime(),
    updatedAt: record.updatedAt.getTime(),
  }));

  return { data, total };
}

// ============================================================================
// API Hooks
// ============================================================================

/**
 * Hook to fetch all reservoirs
 */
export const useFetchReservoirs = () => {
  return useQuery<FetchReservoirsResponse, AxiosError>({
    queryKey: ['reservoirs'],
    queryFn: () => fetchReservoirsLocal(),
  });
};
