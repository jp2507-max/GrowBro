import { Q } from '@nozbe/watermelondb';
import type { Clause } from '@nozbe/watermelondb/QueryDescription';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { createMutation } from 'react-query-kit';

import { useAuth } from '@/lib/auth';
import { useNutrientEngineStore } from '@/lib/nutrient-engine/state/nutrient-engine-store';
import type { PhEcReading, PpmScale } from '@/lib/nutrient-engine/types';
import {
  computeQualityFlags,
  toEC25,
} from '@/lib/nutrient-engine/utils/conversions';
import { database } from '@/lib/watermelon';
import { type PhEcReadingModel } from '@/lib/watermelon-models/ph-ec-reading';

import { client } from '../common';

// ============================================================================
// Error Types
// ============================================================================

export class AccessDeniedError extends Error {
  code: 'ACCESS_DENIED';

  /**
   * Error thrown when user doesn't have permission to access a reading
   * @internal - Message is internal-only, always translated at UI boundary
   */
  constructor(message: string = 'Access denied') {
    super(message);
    this.name = 'AccessDeniedError';
    this.code = 'ACCESS_DENIED';
  }
}

// ============================================================================
// Types
// ============================================================================

type CreateReadingVariables = {
  ph: number;
  ecRaw: number;
  ec25c?: number;
  tempC?: number;
  atcOn?: boolean;
  ppmScale?: PpmScale;
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
  meterId?: string;
  limit?: number;
  offset?: number;
  userId?: string;
};

type FetchReadingsResponse = {
  data: PhEcReading[];
  total: number;
};

// ============================================================================
// Middleware for cache invalidation
// ============================================================================

// Note: Due to react-query-kit limitations with queryClient access in onSuccess,
// we'll handle cache invalidation at the hook usage level in components.
// The mutation itself only performs the database operation.

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Compute EC@25°C based on raw reading and temperature compensation settings
 * @internal
 */
function computeEC25(params: {
  ecRaw: number;
  tempC: number;
  atcOn: boolean;
  tempCompensationBeta: number;
}): number {
  const { ecRaw, tempC, atcOn, tempCompensationBeta } = params;

  if (atcOn) {
    // If meter has ATC active, the raw reading is already compensated
    return ecRaw;
  }

  // Otherwise apply compensation using user preference
  return toEC25(ecRaw, tempC, tempCompensationBeta);
}

/**
 * Map a WatermelonDB model to the PhEcReading type
 * @internal
 */
function mapModelToReading(record: PhEcReadingModel): PhEcReading {
  return {
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
  };
}

/**
 * Apply partial field updates to a reading record
 * Handles ec25c recomputation and quality flag updates
 * @internal
 */
function applyReadingUpdates(options: {
  r: PhEcReadingModel;
  record: PhEcReadingModel;
  variables: Partial<CreateReadingVariables>;
  tempCompensationBeta: number;
}): void {
  const { r, record, variables, tempCompensationBeta } = options;

  if (variables.ph !== undefined) r.ph = variables.ph;
  if (variables.ecRaw !== undefined) r.ecRaw = variables.ecRaw;
  if (variables.tempC !== undefined) r.tempC = variables.tempC;
  if (variables.atcOn !== undefined) r.atcOn = variables.atcOn;
  if (variables.ppmScale !== undefined) r.ppmScale = variables.ppmScale;
  if (variables.reservoirId !== undefined)
    r.reservoirId = variables.reservoirId;
  if (variables.plantId !== undefined) r.plantId = variables.plantId;
  if (variables.meterId !== undefined) r.meterId = variables.meterId;
  if (variables.note !== undefined) r.note = variables.note;

  // Recompute ec25c if dependent fields changed (unless explicitly provided)
  const dependentFieldsChanged =
    variables.ecRaw !== undefined ||
    variables.tempC !== undefined ||
    variables.atcOn !== undefined;

  if (dependentFieldsChanged && variables.ec25c === undefined) {
    r.ec25c = computeEC25({
      ecRaw: variables.ecRaw ?? r.ecRaw,
      tempC: variables.tempC ?? r.tempC,
      atcOn: variables.atcOn ?? r.atcOn,
      tempCompensationBeta,
    });
  } else if (variables.ec25c !== undefined) {
    r.ec25c = variables.ec25c;
  }

  // Re-compute quality flags if relevant fields changed
  const shouldRecomputeFlags =
    variables.ph !== undefined ||
    variables.ecRaw !== undefined ||
    variables.ec25c !== undefined ||
    variables.tempC !== undefined ||
    variables.atcOn !== undefined;

  if (shouldRecomputeFlags) {
    r.qualityFlags = computeQualityFlags({
      id: record.id,
      ph: variables.ph ?? record.ph,
      ecRaw: variables.ecRaw ?? r.ecRaw,
      ec25c: r.ec25c,
      tempC: variables.tempC ?? r.tempC,
      atcOn: variables.atcOn ?? r.atcOn,
      ppmScale: variables.ppmScale ?? (record.ppmScale as PpmScale),
      measuredAt: record.measuredAt,
      createdAt: record.createdAt.getTime(),
      updatedAt: Date.now(),
    });
  }
}

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
  variables: CreateReadingVariables,
  userId: string
): Promise<PhEcReading> {
  const readingsCollection =
    database.get<PhEcReadingModel>('ph_ec_readings_v2');

  // Capture external state before entering the transaction
  const preferences = useNutrientEngineStore.getState().preferences;
  const atcOn = variables.atcOn ?? false;
  const tempC = variables.tempC ?? 25;

  // Compute EC@25°C if not provided, outside the transaction
  const ec25c =
    variables.ec25c ??
    computeEC25({
      ecRaw: variables.ecRaw,
      tempC: tempC,
      atcOn: atcOn,
      tempCompensationBeta: preferences.tempCompensationBeta,
    });

  const reading = await database.write(async () => {
    return await readingsCollection.create((record) => {
      record.userId = userId;
      record.ph = variables.ph;
      record.ecRaw = variables.ecRaw;
      record.ec25c = ec25c;
      record.tempC = tempC;
      record.atcOn = atcOn;
      record.ppmScale = variables.ppmScale ?? '500';
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
        ec25c: ec25c,
        tempC: tempC,
        atcOn: atcOn,
        ppmScale: variables.ppmScale ?? '500',
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
  const readingsCollection =
    database.get<PhEcReadingModel>('ph_ec_readings_v2');

  // Build cumulative where filter array
  const whereFilters: Clause[] = [];

  if (variables.reservoirId) {
    whereFilters.push(Q.where('reservoir_id', variables.reservoirId));
  }

  if (variables.plantId) {
    whereFilters.push(Q.where('plant_id', variables.plantId));
  }

  if (variables.meterId) {
    whereFilters.push(Q.where('meter_id', variables.meterId));
  }

  if (variables.userId) {
    whereFilters.push(Q.where('user_id', variables.userId));
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

/**
 * Fetch a single pH/EC reading by ID from local database
 * @param id - The reading ID
 * @param userId - Optional user ID for ownership validation
 * @returns The reading data or null if not found
 * @throws {AccessDeniedError} When user doesn't own the reading
 * @throws {Error} For unexpected database errors
 */
export async function fetchReadingLocal(
  id: string,
  userId?: string
): Promise<PhEcReading | null> {
  const readingsCollection =
    database.get<PhEcReadingModel>('ph_ec_readings_v2');

  try {
    const record = await readingsCollection.find(id);

    // Validate ownership if userId is provided
    if (userId && record.userId && record.userId !== userId) {
      throw new AccessDeniedError();
    }

    return {
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
    };
  } catch (error) {
    // Handle our custom AccessDeniedError
    if (error instanceof AccessDeniedError) {
      throw error;
    }

    // WatermelonDB throws RecordNotFoundError when record doesn't exist
    // Alternatively, check for the specific error name or code
    if (
      error instanceof Error &&
      (error.name === 'RecordNotFoundError' ||
        error.message.includes('not found'))
    ) {
      return null;
    }
    // Re-throw unexpected errors for proper error handling
    throw error;
  }
}

export async function updateReadingLocal(
  id: string,
  variables: Partial<CreateReadingVariables>,
  userId?: string
): Promise<PhEcReading> {
  const readingsCollection =
    database.get<PhEcReadingModel>('ph_ec_readings_v2');

  // Capture external state before entering the transaction
  const { tempCompensationBeta } =
    useNutrientEngineStore.getState().preferences;

  const reading = await database.write(async () => {
    const record = await readingsCollection.find(id);

    // Validate ownership if userId is provided
    if (userId && record.userId && record.userId !== userId) {
      throw new AccessDeniedError('User does not own this reading');
    }

    await record.update((r) => {
      applyReadingUpdates({ r, record, variables, tempCompensationBeta });
    });
    return record;
  });

  return mapModelToReading(reading);
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
    const { session } = useAuth.getState();
    if (!session?.user.id) {
      throw new Error('User must be authenticated to create readings');
    }

    // Write to local database (offline-first)
    const reading = await createReadingLocal(variables, session.user.id);

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
  const { session } = useAuth();
  const userId = session?.user.id;
  const scopedVariables = { ...variables, userId };

  return useQuery<FetchReadingsResponse, AxiosError>({
    queryKey: ['ph-ec-readings', scopedVariables],
    queryFn: () => fetchReadingsLocal(scopedVariables),
    enabled: !!userId,
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

/**
 * Hook to fetch a single pH/EC reading by ID
 */
export const useFetchReading = (id: string) => {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery<PhEcReading | null, AccessDeniedError | AxiosError>({
    queryKey: ['ph-ec-reading', id, userId],
    queryFn: () => fetchReadingLocal(id, userId),
    enabled: !!id && !!userId,
  });
};

/**
 * Hook to update a pH/EC reading
 */
export const useUpdateReading = createMutation<
  PhEcReading,
  { id: string } & Partial<CreateReadingVariables>,
  AxiosError
>({
  mutationFn: async ({ id, ...variables }) => {
    const { session } = useAuth.getState();
    const userId = session?.user.id;
    return await updateReadingLocal(id, variables, userId);
  },
});

/**
 * Hook to update a pH/EC reading with automatic cache invalidation
 */
export function useUpdateReadingWithInvalidation() {
  const queryClient = useQueryClient();
  return useUpdateReading({
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['ph-ec-reading', variables.id],
      });
      queryClient.invalidateQueries({ queryKey: ['ph-ec-readings'] });
    },
  });
}

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

  type ServerReading = {
    id: string;
    ph: number;
    ec_raw: number;
    ec_25c: number;
    temp_c: number;
    atc_on: boolean;
    ppm_scale: PpmScale;
    reservoir_id?: string;
    plant_id?: string;
    meter_id?: string;
    note?: string;
    quality_flags?: string[];
    measured_at: number;
    created_at: number;
    updated_at: number;
  };

  return {
    readings: response.data.readings.map((r: ServerReading) => ({
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
