/**
 * Reservoir management service
 *
 * Provides CRUD operations and observables for reservoir management
 * with source water profile assignment and target range configuration.
 *
 * Requirements: 1.6, 1.7, 2.8, 8.1
 */

import { Q } from '@nozbe/watermelondb';
import { type Observable } from 'rxjs';

import { createDisposableObservable } from '@/lib/utils/disposable-observable';
import { database } from '@/lib/watermelon';
import type { ReservoirModel } from '@/lib/watermelon-models/reservoir';

import type { GrowingMedium, PpmScale, Reservoir } from '../types';

// ============================================================================
// Type Definitions
// ============================================================================

export type CreateReservoirData = {
  name: string;
  volumeL: number;
  medium: GrowingMedium;
  targetPhMin: number;
  targetPhMax: number;
  targetEcMin25c: number;
  targetEcMax25c: number;
  ppmScale: PpmScale;
  sourceWaterProfileId?: string | null;
  playbookBinding?: string;
};

export type UpdateReservoirData = Partial<Omit<CreateReservoirData, 'medium'>>;

// ============================================================================
// Validation
// ============================================================================

/**
 * Validates reservoir data
 *
 * @param data - Reservoir data to validate
 * @throws Error if validation fails
 */
function validateReservoirData(
  data: Partial<CreateReservoirData>
): asserts data is CreateReservoirData {
  if (data.name !== undefined && data.name.trim().length === 0) {
    throw new Error('Reservoir name cannot be empty');
  }

  if (data.volumeL !== undefined && data.volumeL <= 0) {
    throw new Error('Reservoir volume must be greater than 0');
  }

  if (data.targetPhMin !== undefined && data.targetPhMax !== undefined) {
    if (data.targetPhMin < 0 || data.targetPhMin > 14) {
      throw new Error('Target pH min must be between 0 and 14');
    }
    if (data.targetPhMax < 0 || data.targetPhMax > 14) {
      throw new Error('Target pH max must be between 0 and 14');
    }
    if (data.targetPhMin >= data.targetPhMax) {
      throw new Error('Target pH min must be less than pH max');
    }
  }

  if (data.targetEcMin25c !== undefined && data.targetEcMax25c !== undefined) {
    if (data.targetEcMin25c < 0 || data.targetEcMin25c > 10) {
      throw new Error('Target EC min must be between 0 and 10 mS/cm');
    }
    if (data.targetEcMax25c < 0 || data.targetEcMax25c > 10) {
      throw new Error('Target EC max must be between 0 and 10 mS/cm');
    }
    if (data.targetEcMin25c >= data.targetEcMax25c) {
      throw new Error('Target EC min must be less than EC max');
    }
  }
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Creates a new reservoir
 *
 * @param data - Reservoir data
 * @param userId - User ID for ownership
 * @returns Created reservoir model
 */
export async function createReservoir(
  data: CreateReservoirData,
  userId?: string
): Promise<ReservoirModel> {
  validateReservoirData(data);

  const reservoirsCollection = database.get<ReservoirModel>('reservoirs_v2');

  return await database.write(async () => {
    return await reservoirsCollection.create((reservoir: ReservoirModel) => {
      reservoir.name = data.name.trim();
      reservoir.volumeL = data.volumeL;
      reservoir.medium = data.medium;
      reservoir.targetPhMin = data.targetPhMin;
      reservoir.targetPhMax = data.targetPhMax;
      reservoir.targetEcMin25c = data.targetEcMin25c;
      reservoir.targetEcMax25c = data.targetEcMax25c;
      reservoir.ppmScale = data.ppmScale;
      reservoir.sourceWaterProfileId = data.sourceWaterProfileId;
      reservoir.playbookBinding = data.playbookBinding;
      if (userId) {
        reservoir.userId = userId;
      }
    });
  });
}

/**
 * Updates an existing reservoir
 *
 * @param id - Reservoir ID
 * @param updates - Fields to update
 * @returns Updated reservoir model
 */
export async function updateReservoir(
  id: string,
  updates: UpdateReservoirData
): Promise<ReservoirModel> {
  // Validate updates
  if (Object.keys(updates).length > 0) {
    validateReservoirData(updates as Partial<CreateReservoirData>);
  }

  const reservoirsCollection = database.get<ReservoirModel>('reservoirs_v2');
  const reservoir = await reservoirsCollection.find(id);

  return await database.write(async () => {
    return await reservoir.update((record: ReservoirModel) => {
      if (updates.name !== undefined) {
        record.name = updates.name.trim();
      }
      if (updates.volumeL !== undefined) {
        record.volumeL = updates.volumeL;
      }
      if (updates.targetPhMin !== undefined) {
        record.targetPhMin = updates.targetPhMin;
      }
      if (updates.targetPhMax !== undefined) {
        record.targetPhMax = updates.targetPhMax;
      }
      if (updates.targetEcMin25c !== undefined) {
        record.targetEcMin25c = updates.targetEcMin25c;
      }
      if (updates.targetEcMax25c !== undefined) {
        record.targetEcMax25c = updates.targetEcMax25c;
      }
      if (updates.ppmScale !== undefined) {
        record.ppmScale = updates.ppmScale;
      }
      if ('sourceWaterProfileId' in updates) {
        record.sourceWaterProfileId = updates.sourceWaterProfileId;
      }
      if (updates.playbookBinding !== undefined) {
        record.playbookBinding = updates.playbookBinding;
      }
    });
  });
}

/**
 * Soft deletes a reservoir
 *
 * @param id - Reservoir ID
 */
export async function deleteReservoir(id: string): Promise<void> {
  const reservoirsCollection = database.get<ReservoirModel>('reservoirs_v2');
  const reservoir = await reservoirsCollection.find(id);

  await database.write(async () => {
    await reservoir.markAsDeleted();
  });
}

/**
 * Gets a reservoir by ID
 *
 * @param id - Reservoir ID
 * @returns Reservoir model or null if not found
 */
export async function getReservoir(id: string): Promise<ReservoirModel | null> {
  try {
    const reservoirsCollection = database.get<ReservoirModel>('reservoirs_v2');
    return await reservoirsCollection.find(id);
  } catch {
    return null;
  }
}

/**
 * Lists all active reservoirs for a user
 *
 * @param userId - Optional user ID filter
 * @returns Array of reservoir models
 */
export async function listReservoirs(
  userId?: string
): Promise<ReservoirModel[]> {
  const reservoirsCollection = database.get<ReservoirModel>('reservoirs_v2');

  const query = userId
    ? reservoirsCollection.query(Q.where('user_id', userId))
    : reservoirsCollection.query();

  return await query.fetch();
}

// ============================================================================
// Observables for Reactive UI
// ============================================================================

/**
 * Observes a single reservoir for reactive updates
 *
 * @param id - Reservoir ID
 * @returns Observable of reservoir model
 */
export function observeReservoir(id: string): Observable<ReservoirModel> {
  return createDisposableObservable(async (onNext, onError, isDisposed) => {
    try {
      const reservoir = await getReservoir(id);
      if (isDisposed()) return;
      if (!reservoir) {
        onError(new Error('Reservoir not found'));
        return;
      }

      return reservoir.observe().subscribe({
        next: onNext,
        error: onError,
      });
    } catch (error) {
      if (!isDisposed()) onError(error);
      return undefined;
    }
  });
}

/**
 * Observes all reservoirs for reactive updates
 *
 * @param userId - Optional user ID filter
 * @returns Observable of reservoir array
 */
export function observeReservoirs(
  userId?: string
): Observable<ReservoirModel[]> {
  return createDisposableObservable(async (onNext, onError, isDisposed) => {
    try {
      const reservoirsCollection =
        database.get<ReservoirModel>('reservoirs_v2');

      const query = userId
        ? reservoirsCollection.query(Q.where('user_id', userId))
        : reservoirsCollection.query();

      return query.observe().subscribe({
        next: onNext,
        error: onError,
      });
    } catch (error) {
      if (!isDisposed()) onError(error);
      return undefined;
    }
  });
}

// ============================================================================
// Source Water Profile Assignment
// ============================================================================

/**
 * Assigns a source water profile to a reservoir
 *
 * @param reservoirId - Reservoir ID
 * @param profileId - Source water profile ID (or null to unassign)
 * @returns Updated reservoir model
 */
export async function assignSourceWaterProfile(
  reservoirId: string,
  profileId: string | null
): Promise<ReservoirModel> {
  return await updateReservoir(reservoirId, {
    sourceWaterProfileId: profileId,
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Converts ReservoirModel to Reservoir type
 *
 * @param model - Reservoir model
 * @returns Reservoir type
 */
export function modelToReservoir(model: ReservoirModel): Reservoir {
  return {
    id: model.id,
    name: model.name,
    volumeL: model.volumeL,
    medium: model.medium as GrowingMedium,
    targetPhMin: model.targetPhMin,
    targetPhMax: model.targetPhMax,
    targetEcMin25c: model.targetEcMin25c,
    targetEcMax25c: model.targetEcMax25c,
    ppmScale: model.ppmScale as PpmScale,
    sourceWaterProfileId: model.sourceWaterProfileId,
    playbookBinding: model.playbookBinding,
    createdAt: model.createdAt.getTime(),
    updatedAt: model.updatedAt.getTime(),
  };
}
