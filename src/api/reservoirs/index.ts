import { Q } from '@nozbe/watermelondb';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/lib/auth';
import {
  GrowingMedium,
  type GrowingMedium as GrowingMediumType,
  PpmScale,
  type PpmScale as PpmScaleType,
  type Reservoir,
} from '@/lib/nutrient-engine/types';
import { database } from '@/lib/watermelon';
import type { ReservoirModel } from '@/lib/watermelon-models/reservoir';

// ============================================================================
// Validators
// ============================================================================

const VALID_GROWING_MEDIUMS = Object.values(GrowingMedium);
const VALID_PPM_SCALES = Object.values(PpmScale);

function isValidGrowingMedium(value: string): value is GrowingMediumType {
  return (VALID_GROWING_MEDIUMS as unknown as string[]).includes(value);
}

function isValidPpmScale(value: string): value is PpmScaleType {
  return (VALID_PPM_SCALES as unknown as string[]).includes(value);
}

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

export async function fetchReservoirsLocal(
  userId?: string
): Promise<FetchReservoirsResponse> {
  const reservoirsCollection = database.get<ReservoirModel>('reservoirs_v2');

  let query = reservoirsCollection.query();

  if (userId) {
    query = reservoirsCollection.query(Q.where('user_id', userId));
  }

  const records = await query.fetch();
  const total = records.length;

  const data: Reservoir[] = records.map((record) => {
    if (!isValidGrowingMedium(record.medium)) {
      throw new Error(
        `Invalid growing medium: ${record.medium} for reservoir ${record.id}`
      );
    }
    if (!isValidPpmScale(record.ppmScale)) {
      throw new Error(
        `Invalid PPM scale: ${record.ppmScale} for reservoir ${record.id}`
      );
    }

    return {
      id: record.id,
      name: record.name,
      volumeL: record.volumeL,
      medium: record.medium,
      targetPhMin: record.targetPhMin,
      targetPhMax: record.targetPhMax,
      targetEcMin25c: record.targetEcMin25c,
      targetEcMax25c: record.targetEcMax25c,
      ppmScale: record.ppmScale,
      sourceWaterProfileId: record.sourceWaterProfileId,
      playbookBinding: record.playbookBinding,
      createdAt: record.createdAt.getTime(),
      updatedAt: record.updatedAt.getTime(),
    };
  });

  return { data, total };
}

// ============================================================================
// API Hooks
// ============================================================================

/**
 * Hook to fetch all reservoirs
 */
export const useFetchReservoirs = () => {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery<FetchReservoirsResponse, Error>({
    queryKey: ['reservoirs', userId],
    queryFn: () => fetchReservoirsLocal(userId),
    enabled: !!userId,
  });
};
