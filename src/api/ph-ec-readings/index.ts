import { Q } from '@nozbe/watermelondb';
import { useQuery } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { createMutation } from 'react-query-kit';

import type { PhEcReading, PpmScale } from '@/lib/nutrient-engine/types';
import { computeQualityFlags } from '@/lib/nutrient-engine/utils/conversions';
import { database } from '@/lib/watermelon';
import { type PhEcReadingModel } from '@/lib/watermelon-models/ph-ec-reading';

import { client } from '../common';

// ============================================================================
// Types
// ============================================================================

type CreateReadingVariables = {
  ph: number;
  ecRaw: number;
  ec25c: number;
  tempC: number;
  atcOn: boolean;
  ppmScale: PpmScale;
  reservoirId?: string;
  plantId?: string;
  meterId?: string;
  note?: string;
  measuredAt?: number;
};

type CreateReadingResponse = PhEcReading;

type FetchReadingsVariables = {
  reservoirId?: string;
  plantId?: string;
  limit?: number;
  offset?: number;
};

type FetchReadingsResponse = {
  data: PhEcReading[];
  total: number;
};

// ============================================================================
// Local Database Operations
// ============================================================================

/**
 * Create a pH/EC reading in the local database
 * This is the primary operation for offline-first architecture
 * Reading will be synced to server when connectivity is available
 * @internal
 */
export async function createReadingLocal(
  variables: CreateReadingVariables
): Promise<PhEcReading> {
  const readingsCollection = database.get<PhEcReadingModel>('ph_ec_readings');

  const reading = await database.write(async () => {
    return await readingsCollection.create((record) => {
      record.ph = variables.ph;
      record.ecRaw = variables.ecRaw;
      record.ec25c = variables.ec25c;
      record.tempC = variables.tempC;
      record.atcOn = variables.atcOn;
      record.ppmScale = variables.ppmScale;
      record.measuredAt = variables.measuredAt ?? Date.now();

      if (variables.reservoirId) {
        record.reservoirId = variables.reservoirId;
      }

      if (variables.plantId) {
        record.plantId = variables.plantId;
      }

      if (variables.meterId) {
        record.meterId = variables.meterId;
      }

      if (variables.note) {
        record.note = variables.note;
      }

      // Compute quality flags at creation time
      const qualityFlags = computeQualityFlags({
        id: '', // Not yet assigned
        ph: variables.ph,
        ecRaw: variables.ecRaw,
        ec25c: variables.ec25c,
        tempC: variables.tempC,
        atcOn: variables.atcOn,
        ppmScale: variables.ppmScale,
        measuredAt: variables.measuredAt ?? Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      record.qualityFlags = qualityFlags;
    });
  });

  return {
    id: reading.id,
    ph: reading.ph,
    ecRaw: reading.ecRaw,
    ec25c: reading.ec25c,
    tempC: reading.tempC,
    atcOn: reading.atcOn,
    ppmScale: reading.ppmScale as PpmScale,
    reservoirId: reading.reservoirId,
    plantId: reading.plantId,
    meterId: reading.meterId,
    note: reading.note,
    qualityFlags: reading.qualityFlags,
    measuredAt: reading.measuredAt,
    createdAt: reading.createdAt.getTime(),
    updatedAt: reading.updatedAt.getTime(),
  };
}

export async function fetchReadingsLocal(
  variables: FetchReadingsVariables
): Promise<FetchReadingsResponse> {
  const readingsCollection = database.get<PhEcReadingModel>('ph_ec_readings');

  // Build cumulative where filter array
  const whereFilters: any[] = [];

  if (variables.reservoirId) {
    whereFilters.push(Q.where('reservoir_id', variables.reservoirId));
  }

  if (variables.plantId) {
    whereFilters.push(Q.where('plant_id', variables.plantId));
  }

  const query = readingsCollection.query(
    ...whereFilters,
    Q.sortBy('measured_at', Q.desc)
  );

  // TODO: Implement proper pagination with cursor-based approach
  // Current implementation fetches all records for simplicity
  const records = await query.fetch();
  const total = await readingsCollection.query(...whereFilters).fetchCount();

  // Apply pagination by slicing the results
  let paginatedRecords = records;
  if (variables.limit !== undefined && variables.offset !== undefined) {
    const startIndex = variables.offset;
    const endIndex = startIndex + (variables.limit || records.length);
    paginatedRecords = records.slice(startIndex, endIndex);
  }

  const data: PhEcReading[] = paginatedRecords.map((record) => ({
    id: record.id,
    ph: record.ph,
    ecRaw: record.ecRaw,
    ec25c: record.ec25c,
    tempC: record.tempC,
    atcOn: record.atcOn,
    ppmScale: record.ppmScale as PpmScale,
    reservoirId: record.reservoirId,
    plantId: record.plantId,
    meterId: record.meterId,
    note: record.note,
    qualityFlags: record.qualityFlags,
    measuredAt: record.measuredAt || record.createdAt.getTime(),
    createdAt: record.createdAt.getTime(),
    updatedAt: record.updatedAt.getTime(),
  }));

  return { data, total };
}

// ============================================================================
// API Hooks
// ============================================================================

/**
 * Hook to create a new pH/EC reading
 *
 * Uses offline-first architecture:
 * - Writes to local database immediately
 * - Returns success to user
 * - Sync worker handles server push in background
 *
 * Requirements: 2.1, 2.2, 6.2
 */
export const useCreateReading = createMutation<
  CreateReadingResponse,
  CreateReadingVariables,
  AxiosError
>({
  mutationFn: async (variables) => {
    // Write to local database (offline-first)
    const reading = await createReadingLocal(variables);

    // Sync worker will handle push to server
    // No blocking on network call
    return reading;
  },
});

/**
 * Hook to fetch pH/EC readings
 *
 * Reads from local database for instant response
 * Background sync keeps data current
 *
 * Requirements: 2.1, 2.5, 6.2
 */
export const useFetchReadings = (variables: FetchReadingsVariables) => {
  return useQuery<FetchReadingsResponse, AxiosError>({
    queryKey: ['ph-ec-readings', variables],
    queryFn: () => fetchReadingsLocal(variables),
  });
};

/**
 * Hook to fetch readings for a specific reservoir
 */
export const useReservoirReadings = (reservoirId: string) => {
  return useFetchReadings({ reservoirId });
};

/**
 * Hook to fetch readings for a specific plant
 */
export const usePlantReadings = (plantId: string) => {
  return useFetchReadings({ plantId });
};

// ============================================================================
// Server Sync Operations (Called by sync worker)
// ============================================================================

/**
 * Push reading to server
 * Called by sync worker, not directly by UI
 *
 * @internal
 */
export async function pushReadingToServer(reading: PhEcReading): Promise<void> {
  await client({
    url: '/api/ph-ec-readings',
    method: 'POST',
    data: {
      id: reading.id,
      ph: reading.ph,
      ec_raw: reading.ecRaw,
      ec_25c: reading.ec25c,
      temp_c: reading.tempC,
      atc_on: reading.atcOn,
      ppm_scale: reading.ppmScale,
      reservoir_id: reading.reservoirId,
      plant_id: reading.plantId,
      meter_id: reading.meterId,
      note: reading.note,
      measured_at: reading.measuredAt,
      created_at: reading.createdAt,
    },
  });
}

/**
 * Pull readings from server
 * Called by sync worker for background updates
 *
 * @internal
 */
export async function pullReadingsFromServer(params: {
  lastPulledAt?: number;
  limit?: number;
}): Promise<{
  readings: PhEcReading[];
  serverTimestamp: number;
}> {
  const response = await client({
    url: '/api/ph-ec-readings/sync',
    method: 'GET',
    params: {
      last_pulled_at: params.lastPulledAt,
      limit: params.limit || 100,
    },
  });

  return {
    readings: response.data.readings.map((r: any) => ({
      id: r.id,
      ph: r.ph,
      ecRaw: r.ec_raw,
      ec25c: r.ec_25c,
      tempC: r.temp_c,
      atcOn: r.atc_on,
      ppmScale: r.ppm_scale,
      reservoirId: r.reservoir_id,
      plantId: r.plant_id,
      meterId: r.meter_id,
      note: r.note,
      qualityFlags: r.quality_flags,
      measuredAt: r.measured_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
    serverTimestamp: response.data.server_timestamp,
  };
}
