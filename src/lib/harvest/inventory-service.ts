/**
 * Inventory Service
 *
 * Atomic inventory creation system for harvest finalization.
 * Implements single transactional endpoint with idempotency support.
 *
 * Requirements:
 * - 3.1: Create inventory with final dry weight and stage completion dates
 * - 3.2: Link inventory to plant and harvest records
 * - 3.3: Atomic updates to prevent data inconsistency
 * - 10.1: Single server call for transactional Harvest update + Inventory creation
 * - 10.2: Rollback and retry with exponential backoff on partial failure
 * - 10.3: Accept Idempotency-Key (UUID) for retry safety
 * - 10.4: At-most-once execution with cached response on replay
 * - 10.5: Block finalization if dry weight missing, provide fix CTA
 */

import { Q } from '@nozbe/watermelondb';
import { randomUUID } from 'expo-crypto';

import { categorizeError } from '@/lib/error-handling';
import { supabase } from '@/lib/supabase';
import { computeBackoffMs } from '@/lib/sync/backoff';
import { database } from '@/lib/watermelon';
import type { HarvestModel } from '@/lib/watermelon-models/harvest';
import type { InventoryModel } from '@/lib/watermelon-models/inventory';
import { HarvestStages } from '@/types';
import type {
  CompleteCuringRequest,
  CompleteCuringResponse,
} from '@/types/harvest';

/**
 * Client-specific input for completing curing stage
 */
export interface CompleteCuringInput {
  /** Harvest ID to finalize */
  harvestId: string;

  /** Final dry weight in integer grams (Requirement 11.1) */
  finalWeightG: number;

  /** Optional notes for finalization */
  notes?: string;

  /**
   * Idempotency key for retry safety (UUID v4)
   * Generated automatically if not provided
   * Requirement 10.3
   */
  idempotencyKey?: string;
}

/**
 * Result of curing completion operation
 */
export interface CompleteCuringResult {
  /** Whether operation succeeded */
  success: boolean;

  /** Updated harvest model (local) */
  harvest: HarvestModel | null;

  /** Created inventory model (local) */
  inventory: InventoryModel | null;

  /** Server-authoritative timestamp in milliseconds */
  serverTimestampMs: number | null;

  /** Error message if failed */
  error?: string;

  /**
   * Error code for client handling
   * - MISSING_DRY_WEIGHT: dry weight not set or zero
   * - CONCURRENT_FINALIZE: another process already finalized (409)
   * - VALIDATION: server validation failed (422)
   * - NETWORK: network or transient error
   * - UNKNOWN: unexpected error
   */
  errorCode?:
    | 'MISSING_DRY_WEIGHT'
    | 'CONCURRENT_FINALIZE'
    | 'VALIDATION'
    | 'NETWORK'
    | 'UNKNOWN';
}

/**
 * Maximum retry attempts for transient errors
 * Requirement 10.2
 */
const MAX_RETRY_ATTEMPTS = 3;

/**
 * Initial backoff delay in milliseconds
 */
const INITIAL_BACKOFF_MS = 1000;

/**
 * Maximum backoff delay in milliseconds
 */
const MAX_BACKOFF_MS = 4000;

/**
 * Classify error for retry logic
 * Requirement 10.2
 */
function classifyInventoryError(error: unknown): {
  errorCode: CompleteCuringResult['errorCode'];
  isRetryable: boolean;
} {
  // Check for Supabase PostgREST/PostgresError shapes
  if (
    error &&
    typeof error === 'object' &&
    ('code' in error || 'message' in error || 'details' in error)
  ) {
    const postgrestError = error as {
      code?: string;
      message?: string;
      details?: string;
    };

    // Map SQLSTATE codes to domain errorCodes
    if (postgrestError.code === '23505') {
      // unique_violation - concurrent finalize attempt
      return { errorCode: 'CONCURRENT_FINALIZE', isRetryable: false };
    }

    // Map other SQLSTATE codes from RPC validation to VALIDATION
    if (postgrestError.code && postgrestError.code.startsWith('23')) {
      // Other constraint violations (23xxx codes are integrity constraint violations)
      return { errorCode: 'VALIDATION', isRetryable: false };
    }

    // Check for validation-related error messages
    if (
      postgrestError.message &&
      (postgrestError.message.includes('validation') ||
        postgrestError.message.includes('invalid') ||
        postgrestError.message.includes('check constraint'))
    ) {
      return { errorCode: 'VALIDATION', isRetryable: false };
    }
  }

  // Check for legacy HTTP status codes (backward compatibility)
  const status =
    error &&
    typeof error === 'object' &&
    'response' in error &&
    error.response &&
    typeof error.response === 'object' &&
    'status' in error.response
      ? (error.response as { status: number }).status
      : null;

  if (status === 409) {
    return { errorCode: 'CONCURRENT_FINALIZE', isRetryable: false };
  }

  if (status === 422) {
    return { errorCode: 'VALIDATION', isRetryable: false };
  }

  // Use categorizeError for network/retryable detection
  const { isRetryable } = categorizeError(error);

  // Treat TypeError and other network faults as retryable
  if (error instanceof TypeError || isRetryable) {
    return { errorCode: 'NETWORK', isRetryable: true };
  }

  return { errorCode: 'UNKNOWN', isRetryable: false };
}

/**
 * Validate harvest can be finalized
 * Requirement 10.5
 */
async function validateHarvestForFinalization(
  harvestId: string,
  finalWeightG: number
): Promise<{ valid: boolean; errorCode?: CompleteCuringResult['errorCode'] }> {
  // Validate final weight
  if (!finalWeightG || finalWeightG <= 0) {
    return { valid: false, errorCode: 'MISSING_DRY_WEIGHT' };
  }

  // Validate weight constraints (Requirement 11.3)
  if (finalWeightG > 100_000) {
    return { valid: false, errorCode: 'VALIDATION' };
  }

  // Fetch harvest to check wet weight constraint
  try {
    const harvestsCollection = database.get<HarvestModel>('harvests');
    const harvest = await harvestsCollection.find(harvestId);

    // If wet weight exists, final weight must be less than or equal
    if (harvest.wetWeightG && finalWeightG > harvest.wetWeightG) {
      return { valid: false, errorCode: 'VALIDATION' };
    }

    return { valid: true };
  } catch (error) {
    console.error('[InventoryService] Failed to fetch harvest:', error);
    return { valid: false, errorCode: 'UNKNOWN' };
  }
}

/**
 * Call Supabase RPC with retry logic
 * Requirement 10.2
 */
async function callCompleteCuringRPC(
  request: CompleteCuringRequest,
  attemptNumber = 1
): Promise<{ data: CompleteCuringResponse | null; error: unknown }> {
  try {
    const { data, error } = await supabase.rpc(
      'complete_curing_and_create_inventory',
      {
        p_harvest_id: request.harvest_id,
        p_final_weight_g: request.final_weight_g,
        p_notes: request.notes ?? null,
        p_idempotency_key: request.idempotency_key,
      }
    );

    if (error) {
      throw error;
    }

    // Parse JSONB response
    const response = data as unknown as CompleteCuringResponse;
    return { data: response, error: null };
  } catch (error) {
    const { isRetryable } = classifyInventoryError(error);

    // Retry transient errors with exponential backoff
    if (isRetryable && attemptNumber < MAX_RETRY_ATTEMPTS) {
      const delay = computeBackoffMs(
        attemptNumber,
        INITIAL_BACKOFF_MS,
        MAX_BACKOFF_MS
      );
      console.log(
        `[InventoryService] Retry attempt ${attemptNumber + 1}/${MAX_RETRY_ATTEMPTS} after ${delay}ms`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      return callCompleteCuringRPC(request, attemptNumber + 1);
    }

    return { data: null, error };
  }
}

/**
 * Update local WatermelonDB state after successful RPC
 * Requirement 3.1, 3.2, 3.4
 */
async function updateLocalState(
  harvestId: string,
  response: CompleteCuringResponse,
  finalizedWeightG: number
): Promise<{ harvest: HarvestModel; inventory: InventoryModel } | null> {
  try {
    const harvestsCollection = database.get<HarvestModel>('harvests');
    const inventoryCollection = database.get<InventoryModel>('inventory');

    return await database.write(async () => {
      // Update harvest to INVENTORY stage
      const harvest = await harvestsCollection.find(harvestId);
      const updatedHarvest = await harvest.update((record) => {
        record.stage = HarvestStages.INVENTORY;
        record.dryWeightG = finalizedWeightG ?? record.dryWeightG ?? 0;
        record.stageStartedAt = new Date(response.server_timestamp_ms);
        record.stageCompletedAt = new Date(response.server_timestamp_ms);
        record.serverUpdatedAtMs = response.server_timestamp_ms;
      });

      // Create inventory record
      const inventory = await inventoryCollection.create((record) => {
        record._raw.id = response.inventory_id;
        record.harvestId = response.harvest_id;
        record.plantId = harvest.plantId;
        record.userId = harvest.userId;
        record.finalWeightG = finalizedWeightG ?? harvest.dryWeightG ?? 0;
        record.harvestDate = new Date(response.server_timestamp_ms)
          .toISOString()
          .split('T')[0]; // ISO date
        record.totalDurationDays = Math.floor(
          (response.server_timestamp_ms - harvest.createdAt.getTime()) /
            86400000
        );
        record.serverUpdatedAtMs = response.server_timestamp_ms;
      });

      return { harvest: updatedHarvest, inventory };
    });
  } catch (error) {
    console.error('[InventoryService] Failed to update local state:', error);
    return null;
  }
}

/**
 * Execute atomic curing completion with idempotency
 * Requirements: 10.1, 10.2, 10.4
 */
async function executeCompleteCuring(params: {
  harvestId: string;
  finalWeightG: number;
  notes?: string;
  idempotencyKey: string;
}): Promise<CompleteCuringResult> {
  const request: CompleteCuringRequest = {
    harvest_id: params.harvestId,
    final_weight_g: params.finalWeightG,
    notes: params.notes,
    idempotency_key: params.idempotencyKey,
  };

  const { data, error } = await callCompleteCuringRPC(request);

  if (error || !data) {
    const { errorCode } = classifyInventoryError(error);
    return {
      success: false,
      harvest: null,
      inventory: null,
      serverTimestampMs: null,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to complete curing and create inventory',
      errorCode,
    };
  }

  const localState = await updateLocalState(
    params.harvestId,
    data,
    params.finalWeightG
  );

  if (!localState) {
    console.warn('[InventoryService] Local state update failed');
    return {
      success: true,
      harvest: null,
      inventory: null,
      serverTimestampMs: data.server_timestamp_ms,
      error: 'Local state update failed; server state is authoritative',
      errorCode: 'UNKNOWN',
    };
  }

  return {
    success: true,
    harvest: localState.harvest,
    inventory: localState.inventory,
    serverTimestampMs: data.server_timestamp_ms,
  };
}

/**
 * Complete curing stage and create inventory atomically
 *
 * Performs atomic Harvest→INVENTORY update + Inventory creation in single
 * transactional server call with idempotency support.
 *
 * Requirements: 3.1, 3.2, 3.3, 10.1, 10.2, 10.3, 10.4, 10.5
 *
 * @param input Completion input with harvest ID, final weight, and optional idempotency key
 * @returns Result with updated harvest, created inventory, and server timestamp
 */
export async function completeCuring(
  input: CompleteCuringInput
): Promise<CompleteCuringResult> {
  // Generate idempotency key if not provided (Requirement 10.3)
  const idempotencyKey = input.idempotencyKey ?? randomUUID();

  // Pre-flight validation (Requirement 10.5)
  const validation = await validateHarvestForFinalization(
    input.harvestId,
    input.finalWeightG
  );
  if (!validation.valid) {
    return {
      success: false,
      harvest: null,
      inventory: null,
      serverTimestampMs: null,
      error:
        validation.errorCode === 'MISSING_DRY_WEIGHT'
          ? 'Dry weight must be set before finalizing curing'
          : 'Validation failed: invalid weight constraints',
      errorCode: validation.errorCode,
    };
  }

  // Execute atomic operation (Requirement 10.1, 10.2, 10.4)
  return executeCompleteCuring({
    harvestId: input.harvestId,
    finalWeightG: input.finalWeightG,
    notes: input.notes,
    idempotencyKey,
  });
}

/**
 * Get inventory by harvest ID
 * Helper for fetching existing inventory records
 *
 * @param harvestId Harvest ID
 * @returns Inventory model or null
 */
export async function getInventoryByHarvestId(
  harvestId: string
): Promise<InventoryModel | null> {
  try {
    const inventoryCollection = database.get<InventoryModel>('inventory');
    const inventories = await inventoryCollection
      .query(Q.where('harvest_id', harvestId))
      .fetch();

    return inventories[0] ?? null;
  } catch (error) {
    console.error('[InventoryService] Failed to get inventory:', error);
    return null;
  }
}
