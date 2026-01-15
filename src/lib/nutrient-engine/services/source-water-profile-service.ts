/**
 * Source water profile management service
 *
 * Provides CRUD operations and observables for source water profile management.
 * Tracks baseline water quality parameters for pH drift warnings and accurate
 * nutrient calculations.
 *
 * Requirements: 8.1, 8.2, 8.5
 */

import { Q } from '@nozbe/watermelondb';
import { Observable } from 'rxjs';

import { database } from '@/lib/watermelon';
import type { SourceWaterProfileModel } from '@/lib/watermelon-models/source-water-profile';

import type { SourceWaterProfile } from '../types';

// ============================================================================
// Type Definitions
// ============================================================================

export type CreateSourceWaterProfileData = {
  name: string;
  baselineEc25c: number;
  alkalinityMgPerLCaco3: number;
  hardnessMgPerL: number;
  lastTestedAt?: number; // epoch ms, defaults to now
};

export type UpdateSourceWaterProfileData = Partial<
  Omit<CreateSourceWaterProfileData, 'lastTestedAt'>
> & {
  lastTestedAt?: number; // Allow explicit update for retesting
};

// ============================================================================
// Validation
// ============================================================================

/**
 * Validates source water profile data
 *
 * @param data - Profile data to validate
 * @throws Error if validation fails
 */
function validateProfileData(
  data: Partial<CreateSourceWaterProfileData>
): asserts data is CreateSourceWaterProfileData {
  if (data.name !== undefined && data.name.trim().length === 0) {
    throw new Error('Profile name cannot be empty');
  }

  if (data.baselineEc25c !== undefined) {
    if (data.baselineEc25c < 0 || data.baselineEc25c > 5.0) {
      throw new Error('Baseline EC must be between 0 and 5.0 mS/cm');
    }
  }

  if (data.alkalinityMgPerLCaco3 !== undefined) {
    if (data.alkalinityMgPerLCaco3 < 0 || data.alkalinityMgPerLCaco3 > 500) {
      throw new Error('Alkalinity must be between 0 and 500 mg/L as CaCO₃');
    }
  }

  if (data.hardnessMgPerL !== undefined) {
    if (data.hardnessMgPerL < 0 || data.hardnessMgPerL > 1000) {
      throw new Error('Hardness must be between 0 and 1000 mg/L');
    }
  }

  if (data.lastTestedAt !== undefined) {
    if (data.lastTestedAt > Date.now()) {
      throw new Error('Test date cannot be in the future');
    }
  }
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Creates a new source water profile
 *
 * @param data - Profile data
 * @param userId - User ID for ownership
 * @returns Created profile model
 */
export async function createSourceWaterProfile(
  data: CreateSourceWaterProfileData,
  userId?: string
): Promise<SourceWaterProfileModel> {
  validateProfileData(data);

  const profilesCollection = database.get<SourceWaterProfileModel>(
    'source_water_profiles_v2'
  );

  return await database.write(async () => {
    return await profilesCollection.create(
      (profile: SourceWaterProfileModel) => {
        profile.name = data.name.trim();
        profile.baselineEc25c = data.baselineEc25c;
        profile.alkalinityMgPerLCaCO3 = data.alkalinityMgPerLCaco3;
        profile.hardnessMgPerL = data.hardnessMgPerL;
        profile.lastTestedAt = data.lastTestedAt ?? Date.now();
        if (userId) {
          profile.userId = userId;
        }
      }
    );
  });
}

/**
 * Updates an existing source water profile
 *
 * @param id - Profile ID
 * @param updates - Fields to update
 * @returns Updated profile model
 */
export async function updateSourceWaterProfile(
  id: string,
  updates: UpdateSourceWaterProfileData
): Promise<SourceWaterProfileModel> {
  // Validate updates
  if (Object.keys(updates).length > 0) {
    validateProfileData(updates as Partial<CreateSourceWaterProfileData>);
  }

  const profilesCollection = database.get<SourceWaterProfileModel>(
    'source_water_profiles_v2'
  );
  const profile = await profilesCollection.find(id);

  return await database.write(async () => {
    return await profile.update((record: SourceWaterProfileModel) => {
      if (updates.name !== undefined) {
        record.name = updates.name.trim();
      }
      if (updates.baselineEc25c !== undefined) {
        record.baselineEc25c = updates.baselineEc25c;
      }
      if (updates.alkalinityMgPerLCaco3 !== undefined) {
        record.alkalinityMgPerLCaCO3 = updates.alkalinityMgPerLCaco3;
      }
      if (updates.hardnessMgPerL !== undefined) {
        record.hardnessMgPerL = updates.hardnessMgPerL;
      }
      if (updates.lastTestedAt !== undefined) {
        record.lastTestedAt = updates.lastTestedAt;
      }
    });
  });
}

/**
 * Soft deletes a source water profile
 *
 * @param id - Profile ID
 */
export async function deleteSourceWaterProfile(id: string): Promise<void> {
  const profilesCollection = database.get<SourceWaterProfileModel>(
    'source_water_profiles_v2'
  );
  const profile = await profilesCollection.find(id);

  await database.write(async () => {
    await profile.markAsDeleted();
  });
}

/**
 * Gets a source water profile by ID
 *
 * @param id - Profile ID
 * @returns Profile model or null if not found
 */
export async function getSourceWaterProfile(
  id: string
): Promise<SourceWaterProfileModel | null> {
  try {
    const profilesCollection = database.get<SourceWaterProfileModel>(
      'source_water_profiles_v2'
    );
    return await profilesCollection.find(id);
  } catch {
    return null;
  }
}

/**
 * Lists all active source water profiles for a user
 *
 * @param userId - Optional user ID filter
 * @returns Array of profile models
 */
export async function listSourceWaterProfiles(
  userId?: string
): Promise<SourceWaterProfileModel[]> {
  const profilesCollection = database.get<SourceWaterProfileModel>(
    'source_water_profiles_v2'
  );

  const query = userId
    ? profilesCollection.query(Q.where('user_id', userId))
    : profilesCollection.query();

  return await query.fetch();
}

// ============================================================================
// Observables for Reactive UI
// ============================================================================

/**
 * Observes a single source water profile for reactive updates
 *
 * @param id - Profile ID
 * @returns Observable of profile model
 */
export function observeSourceWaterProfile(
  id: string
): Observable<SourceWaterProfileModel> {
  return new Observable((subscriber) => {
    let isDisposed = false;
    let subscription: { unsubscribe: () => void } | undefined;

    const setup = async () => {
      try {
        const profile = await getSourceWaterProfile(id);
        if (isDisposed) return;
        if (!profile) {
          subscriber.error(new Error('Source water profile not found'));
          return;
        }

        const nextSub = profile.observe().subscribe({
          next: (updated) => subscriber.next(updated),
          error: (error) => subscriber.error(error),
        });
        if (isDisposed) {
          nextSub.unsubscribe();
          return;
        }
        subscription = nextSub;
      } catch (error) {
        if (!isDisposed) subscriber.error(error);
      }
    };

    void setup();

    return () => {
      isDisposed = true;
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  });
}

/**
 * Observes all source water profiles for reactive updates
 *
 * @param userId - Optional user ID filter
 * @returns Observable of profile array
 */
export function observeSourceWaterProfiles(
  userId?: string
): Observable<SourceWaterProfileModel[]> {
  return new Observable((subscriber) => {
    let isDisposed = false;
    let subscription: { unsubscribe: () => void } | undefined;

    const setup = async () => {
      try {
        const profilesCollection = database.get<SourceWaterProfileModel>(
          'source_water_profiles_v2'
        );

        const query = userId
          ? profilesCollection.query(Q.where('user_id', userId))
          : profilesCollection.query();

        const nextSub = query.observe().subscribe({
          next: (profiles: SourceWaterProfileModel[]) =>
            subscriber.next(profiles),
          error: (error: unknown) => subscriber.error(error),
        });
        if (isDisposed) {
          nextSub.unsubscribe();
          return;
        }
        subscription = nextSub;
      } catch (error) {
        if (!isDisposed) subscriber.error(error);
      }
    };

    void setup();

    return () => {
      isDisposed = true;
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Converts SourceWaterProfileModel to SourceWaterProfile type
 *
 * @param model - Source water profile model
 * @returns SourceWaterProfile type
 */
export function modelToSourceWaterProfile(
  model: SourceWaterProfileModel
): SourceWaterProfile {
  return {
    id: model.id,
    name: model.name,
    baselineEc25c: model.baselineEc25c,
    alkalinityMgPerLCaco3: model.alkalinityMgPerLCaCO3,
    hardnessMgPerL: model.hardnessMgPerL,
    lastTestedAt: model.lastTestedAt,
    createdAt: model.createdAt.getTime(),
    updatedAt: model.updatedAt.getTime(),
  };
}
