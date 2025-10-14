/**
 * Reservoir event tracking service
 *
 * Provides event logging for reservoir changes with undo capability,
 * chart annotation support, and dose calculation helpers.
 *
 * Requirements: 1.6, 1.7, 2.5, 2.8, 7.6
 */

import { Q } from '@nozbe/watermelondb';
import { Observable } from 'rxjs';

import { database } from '@/lib/watermelon';
import type { ReservoirEventModel } from '@/lib/watermelon-models/reservoir-event';

import type { ReservoirEvent, ReservoirEventKind } from '../types';

// ============================================================================
// Type Definitions
// ============================================================================

export type CreateReservoirEventData = {
  reservoirId: string;
  kind: ReservoirEventKind;
  deltaEc25c?: number;
  deltaPh?: number;
  note?: string;
};

export type DoseRecommendation = {
  targetEc25c: number;
  currentEc25c: number;
  volumeL: number;
  stockConcentration: number; // mS/cm per mL/L
  recommendedAdditionML: number;
  safetyMargin: number;
  steps: DoseStep[];
  warnings: string[];
};

export type DoseStep = {
  stepNumber: number;
  additionML: number;
  expectedEc25c: number;
  waitTimeMinutes: number;
  instructions: string;
};

// ============================================================================
// Constants
// ============================================================================

const UNDO_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const SAFETY_MARGIN = 0.9; // Conservative 90% of calculated dose
const DOSE_STEP_SIZE = 0.2; // Maximum EC change per step (mS/cm)
const MIXING_TIME_MINUTES = 15; // Wait time between doses for mixing

// ============================================================================
// Validation
// ============================================================================

/**
 * Validates reservoir event data
 *
 * @param data - Event data to validate
 * @throws Error if validation fails
 */
function validateEventData(data: CreateReservoirEventData): void {
  if (!data.reservoirId || data.reservoirId.trim().length === 0) {
    throw new Error('Reservoir ID is required');
  }

  if (!data.kind) {
    throw new Error('Event kind is required');
  }

  // Validate deltas are reasonable
  if (data.deltaEc25c !== undefined) {
    if (Math.abs(data.deltaEc25c) > 10) {
      throw new Error('EC delta exceeds reasonable range (±10 mS/cm)');
    }
  }

  if (data.deltaPh !== undefined) {
    if (Math.abs(data.deltaPh) > 7) {
      throw new Error('pH delta exceeds reasonable range (±7)');
    }
  }
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Creates a new reservoir event
 *
 * @param data - Event data
 * @param userId - Optional user ID for ownership
 * @returns Created event model
 */
export async function createReservoirEvent(
  data: CreateReservoirEventData,
  userId?: string
): Promise<ReservoirEventModel> {
  validateEventData(data);

  const eventsCollection =
    database.get<ReservoirEventModel>('reservoir_events');

  return await database.write(async () => {
    return await eventsCollection.create((event: any) => {
      event.reservoirId = data.reservoirId;
      event.kind = data.kind;
      if (data.deltaEc25c !== undefined) {
        event.deltaEc25c = data.deltaEc25c;
      }
      if (data.deltaPh !== undefined) {
        event.deltaPh = data.deltaPh;
      }
      if (data.note) {
        event.note = data.note;
      }
      if (userId) {
        event.userId = userId;
      }
    });
  });
}

/**
 * Gets recent events for a reservoir (within undo window)
 *
 * @param reservoirId - Reservoir ID
 * @returns Array of recent event models
 */
export async function getRecentEvents(
  reservoirId: string
): Promise<ReservoirEventModel[]> {
  const eventsCollection =
    database.get<ReservoirEventModel>('reservoir_events');
  const cutoffTime = Date.now() - UNDO_WINDOW_MS;

  return await eventsCollection
    .query(
      Q.where('reservoir_id', reservoirId),
      Q.where('created_at', Q.gte(cutoffTime)),
      Q.sortBy('created_at', Q.desc)
    )
    .fetch();
}

/**
 * Undoes the last event by creating a compensating event
 *
 * @param reservoirId - Reservoir ID
 * @param userId - Optional user ID
 * @returns Compensating event model or null if no recent event
 */
export async function undoLastEvent(
  reservoirId: string,
  userId?: string
): Promise<ReservoirEventModel | null> {
  const recentEvents = await getRecentEvents(reservoirId);

  if (recentEvents.length === 0) {
    return null;
  }

  const lastEvent = recentEvents[0];

  // Create compensating event with opposite deltas
  const compensatingData: CreateReservoirEventData = {
    reservoirId,
    kind: 'CHANGE',
    deltaEc25c:
      lastEvent.deltaEc25c !== undefined ? -lastEvent.deltaEc25c : undefined,
    deltaPh: lastEvent.deltaPh !== undefined ? -lastEvent.deltaPh : undefined,
    note: `Undo: ${lastEvent.kind}${lastEvent.note ? ` (${lastEvent.note})` : ''}`,
  };

  return await createReservoirEvent(compensatingData, userId);
}

/**
 * Lists all events for a reservoir
 *
 * @param reservoirId - Reservoir ID
 * @param limit - Maximum number of events to return
 * @returns Array of event models
 */
export async function listEventsByReservoir(
  reservoirId: string,
  limit: number = 100
): Promise<ReservoirEventModel[]> {
  const eventsCollection =
    database.get<ReservoirEventModel>('reservoir_events');

  return await eventsCollection
    .query(
      Q.where('reservoir_id', reservoirId),
      Q.sortBy('created_at', Q.desc),
      Q.take(limit)
    )
    .fetch();
}

/**
 * Lists events for a reservoir within a date range
 *
 * @param reservoirId - Reservoir ID
 * @param startMs - Start timestamp in milliseconds
 * @param endMs - End timestamp in milliseconds
 * @returns Array of event models
 */
export async function listEventsByDateRange(
  reservoirId: string,
  startMs: number,
  endMs: number
): Promise<ReservoirEventModel[]> {
  const eventsCollection =
    database.get<ReservoirEventModel>('reservoir_events');

  return await eventsCollection
    .query(
      Q.where('reservoir_id', reservoirId),
      Q.where('created_at', Q.gte(startMs)),
      Q.where('created_at', Q.lte(endMs)),
      Q.sortBy('created_at', Q.asc)
    )
    .fetch();
}

/**
 * Deletes an event (soft delete)
 *
 * @param eventId - Event ID
 */
export async function deleteReservoirEvent(eventId: string): Promise<void> {
  const eventsCollection =
    database.get<ReservoirEventModel>('reservoir_events');
  const event = await eventsCollection.find(eventId);

  await database.write(async () => {
    await event.markAsDeleted();
  });
}

// ============================================================================
// Observables for Reactive UI
// ============================================================================

/**
 * Observes events for a reservoir for reactive chart updates
 *
 * @param reservoirId - Reservoir ID
 * @param limit - Maximum number of events to observe
 * @returns Observable of event array
 */
export function observeReservoirEvents(
  reservoirId: string,
  limit: number = 100
): Observable<ReservoirEventModel[]> {
  return new Observable((subscriber) => {
    let subscription: any;

    const setup = async () => {
      try {
        const eventsCollection =
          database.get<ReservoirEventModel>('reservoir_events');

        const query = eventsCollection.query(
          Q.where('reservoir_id', reservoirId),
          Q.sortBy('created_at', Q.desc),
          Q.take(limit)
        );

        subscription = query.observe().subscribe({
          next: (events: any) => subscriber.next(events),
          error: (error: any) => subscriber.error(error),
        });
      } catch (error) {
        subscriber.error(error);
      }
    };

    void setup();

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  });
}

/**
 * Observes recent events within undo window
 *
 * @param reservoirId - Reservoir ID
 * @returns Observable of recent event array
 */
export function observeRecentEvents(
  reservoirId: string
): Observable<ReservoirEventModel[]> {
  return new Observable((subscriber) => {
    let subscription: any;

    const setup = async () => {
      try {
        const eventsCollection =
          database.get<ReservoirEventModel>('reservoir_events');

        const query = eventsCollection.query(
          Q.where('reservoir_id', reservoirId),
          Q.sortBy('created_at', Q.desc)
        );

        subscription = query.observe().subscribe({
          next: (events: any) => {
            const cutoff = Date.now() - UNDO_WINDOW_MS;
            const recentEvents = events.filter(
              (event: ReservoirEventModel) =>
                event.createdAt.getTime() >= cutoff
            );
            subscriber.next(recentEvents);
          },
          error: (error: any) => subscriber.error(error),
        });
      } catch (error) {
        subscriber.error(error);
      }
    };

    void setup();

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  });
}

// ============================================================================
// Dose Calculation Helpers (Requirement 2.8)
// ============================================================================

export type DoseCalculationParams = {
  currentEc25c: number;
  targetEc25c: number;
  volumeL: number;
  stockConcentration: number;
};

function validateDoseParams(params: DoseCalculationParams): string[] {
  const warnings: string[] = [];

  // Check for null/undefined parameters
  if (params.currentEc25c == null || isNaN(params.currentEc25c)) {
    warnings.push('Current EC value is required and must be a valid number');
  }
  if (params.targetEc25c == null || isNaN(params.targetEc25c)) {
    warnings.push('Target EC value is required and must be a valid number');
  }
  if (params.volumeL == null || isNaN(params.volumeL)) {
    warnings.push('Reservoir volume is required and must be a valid number');
  }
  if (params.stockConcentration == null || isNaN(params.stockConcentration)) {
    warnings.push('Stock concentration is required and must be a valid number');
  }

  // Check for negative EC values
  if (params.currentEc25c < 0) {
    warnings.push('Current EC cannot be negative');
  }
  if (params.targetEc25c < 0) {
    warnings.push('Target EC cannot be negative');
  }

  // Check ranges (allow negative values to be caught above, but still warn about extreme values)
  if (params.currentEc25c > 10) {
    warnings.push('Current EC outside normal range (0-10 mS/cm)');
  }
  if (params.targetEc25c > 10) {
    warnings.push('Target EC outside normal range (0-10 mS/cm)');
  }
  if (params.volumeL <= 0 || params.volumeL > 1000) {
    warnings.push(
      'Reservoir volume outside reasonable range (must be positive and ≤ 1000L)'
    );
  }
  if (params.stockConcentration <= 0) {
    warnings.push('Stock concentration must be positive');
  }

  return warnings;
}

function generateDoseSteps(
  params: DoseCalculationParams,
  safeAdditionML: number
): { steps: DoseStep[]; warnings: string[] } {
  const steps: DoseStep[] = [];
  const warnings: string[] = [];
  let remainingAdditionML = safeAdditionML;
  let currentStepEc = params.currentEc25c;
  let stepNumber = 1;

  while (remainingAdditionML > 0.1) {
    const maxStepEc = currentStepEc + DOSE_STEP_SIZE;
    const stepTargetEc = Math.min(maxStepEc, params.targetEc25c);
    const stepEcIncrease = stepTargetEc - currentStepEc;
    const stepAdditionML =
      (stepEcIncrease * params.volumeL) / params.stockConcentration;
    const actualAdditionML = Math.min(stepAdditionML, remainingAdditionML);
    const actualEcIncrease =
      (actualAdditionML * params.stockConcentration) / params.volumeL;

    steps.push({
      stepNumber,
      additionML: Math.round(actualAdditionML * 10) / 10,
      expectedEc25c: Math.round((currentStepEc + actualEcIncrease) * 100) / 100,
      waitTimeMinutes: MIXING_TIME_MINUTES,
      instructions: `Add ${Math.round(actualAdditionML * 10) / 10}mL of stock solution (+${Math.round(actualEcIncrease * 100) / 100} EC). Mix thoroughly and wait ${MIXING_TIME_MINUTES} minutes before measuring.`,
    });

    remainingAdditionML -= actualAdditionML;
    currentStepEc += actualEcIncrease;
    stepNumber++;

    if (stepNumber > 10) {
      warnings.push('Addition broken into maximum 10 steps for safety');
      break;
    }
  }
  return { steps, warnings };
}

/**
 * Helper to create error result with default values
 */
function createErrorResult(
  params: DoseCalculationParams,
  errorMessages: string[],
  baseWarnings: string[]
): DoseRecommendation {
  return {
    targetEc25c: params.targetEc25c || 0,
    currentEc25c: params.currentEc25c || 0,
    volumeL: params.volumeL || 0,
    stockConcentration: params.stockConcentration || 0,
    recommendedAdditionML: 0,
    safetyMargin: SAFETY_MARGIN,
    steps: [],
    warnings: [...errorMessages, ...baseWarnings],
  };
}

/**
 * Validates parameters and returns error result if invalid
 */
function validateCalculationParams(
  params: DoseCalculationParams,
  warnings: string[]
): DoseRecommendation | null {
  const hasInvalidParams =
    params.currentEc25c == null ||
    isNaN(params.currentEc25c) ||
    params.targetEc25c == null ||
    isNaN(params.targetEc25c) ||
    params.volumeL == null ||
    isNaN(params.volumeL) ||
    params.stockConcentration == null ||
    isNaN(params.stockConcentration);

  if (hasInvalidParams) {
    return createErrorResult(
      params,
      [
        'All parameters must be valid numbers to calculate dose recommendation.',
      ],
      warnings
    );
  }

  if (params.stockConcentration <= 0) {
    return createErrorResult(
      params,
      [
        'Stock concentration must be positive to calculate dose recommendation.',
      ],
      warnings
    );
  }

  if (params.volumeL <= 0) {
    return createErrorResult(
      params,
      ['Reservoir volume must be positive to calculate dose recommendation.'],
      warnings
    );
  }

  if (params.currentEc25c < 0) {
    return createErrorResult(
      params,
      ['Current EC cannot be negative.'],
      warnings
    );
  }

  if (params.targetEc25c < 0) {
    return createErrorResult(
      params,
      ['Target EC cannot be negative.'],
      warnings
    );
  }

  const ecDiff = params.targetEc25c - params.currentEc25c;
  if (ecDiff <= 0) {
    return createErrorResult(
      params,
      ['Current EC is at or above target. No nutrient addition recommended.'],
      warnings
    );
  }

  return null;
}

/**
 * Calculates conservative stepwise nutrient additions to reach target EC
 * EDUCATIONAL GUIDANCE ONLY - Not product promotion
 */
export function calculateDoseRecommendation(
  params: DoseCalculationParams
): DoseRecommendation {
  const warnings = validateDoseParams(params);
  const validationError = validateCalculationParams(params, warnings);

  if (validationError) {
    return validationError;
  }

  const ecDiff = params.targetEc25c - params.currentEc25c;
  const totalAdditionML = (ecDiff * params.volumeL) / params.stockConcentration;
  const safeAdditionML = totalAdditionML * SAFETY_MARGIN;
  const { steps, warnings: stepWarnings } = generateDoseSteps(
    params,
    safeAdditionML
  );

  return {
    targetEc25c: params.targetEc25c,
    currentEc25c: params.currentEc25c,
    volumeL: params.volumeL,
    stockConcentration: params.stockConcentration,
    recommendedAdditionML: Math.round(safeAdditionML * 10) / 10,
    safetyMargin: SAFETY_MARGIN,
    steps,
    warnings: [
      ...warnings,
      ...stepWarnings,
      'EDUCATIONAL GUIDANCE ONLY: Always verify measurements after each addition.',
      'Conservative dosing at 90% of calculated amount to prevent overshooting.',
      'Wait for full mixing and temperature stabilization before measuring.',
      'Consider your specific nutrients and growing medium requirements.',
    ],
  };
}

export type DilutionCalculationParams = {
  currentEc25c: number;
  targetEc25c: number;
  currentVolumeL: number;
  sourceWaterEc25c?: number;
};

export type DilutionRecommendation = {
  dilutionVolumeL: number;
  finalVolumeL: number;
  steps: string[];
  warnings: string[];
};

function generateDilutionSteps(
  dilutionVolumeL: number,
  sourceWaterEc25c: number,
  targetEc25c: number
): { steps: string[]; warnings: string[] } {
  const steps = [
    `Remove ${Math.round(dilutionVolumeL * 10) / 10}L from reservoir if needed to make room.`,
    `Add ${Math.round(dilutionVolumeL * 10) / 10}L of source water (EC: ${sourceWaterEc25c} mS/cm).`,
    `Mix thoroughly for at least ${MIXING_TIME_MINUTES} minutes.`,
    `Measure EC at 25°C to verify target of ${targetEc25c} mS/cm is reached.`,
    'If needed, adjust nutrients to maintain proper ratios.',
  ];

  const warnings = [
    'EDUCATIONAL GUIDANCE ONLY: Ensure source water is pH-adjusted before adding.',
    'Mix thoroughly and allow temperature stabilization before measuring.',
    'Verify your reservoir can accommodate the additional volume.',
    'Consider whether nutrients also need rebalancing after dilution.',
  ];

  return { steps, warnings };
}

/**
 * Calculates dilution volume needed to lower EC to target
 * EDUCATIONAL GUIDANCE ONLY - Not product promotion
 */
export function calculateDilutionRecommendation(
  params: DilutionCalculationParams
): DilutionRecommendation {
  const sourceWaterEc25c = params.sourceWaterEc25c ?? 0;

  if (params.currentEc25c <= params.targetEc25c) {
    return {
      dilutionVolumeL: 0,
      finalVolumeL: params.currentVolumeL,
      steps: [],
      warnings: ['Current EC is at or below target. No dilution needed.'],
    };
  }

  if (params.targetEc25c <= sourceWaterEc25c) {
    return {
      dilutionVolumeL: 0,
      finalVolumeL: params.currentVolumeL,
      steps: [],
      warnings: [
        'Target EC is at or below source water EC. Dilution will not achieve target.',
      ],
    };
  }

  const dilutionVolumeL =
    (params.currentVolumeL * (params.currentEc25c - params.targetEc25c)) /
    (params.targetEc25c - sourceWaterEc25c);
  const finalVolumeL = params.currentVolumeL + dilutionVolumeL;

  const { steps, warnings } = generateDilutionSteps(
    dilutionVolumeL,
    sourceWaterEc25c,
    params.targetEc25c
  );

  return {
    dilutionVolumeL: Math.round(dilutionVolumeL * 10) / 10,
    finalVolumeL: Math.round(finalVolumeL * 10) / 10,
    steps,
    warnings,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Converts ReservoirEventModel to ReservoirEvent type
 *
 * @param model - Reservoir event model
 * @returns ReservoirEvent type
 */
export function modelToReservoirEvent(
  model: ReservoirEventModel
): ReservoirEvent {
  return {
    id: model.id,
    reservoirId: model.reservoirId,
    kind: model.kind as ReservoirEventKind,
    deltaEc25c: model.deltaEc25c,
    deltaPh: model.deltaPh,
    note: model.note,
    createdAt: model.createdAt.getTime(),
    updatedAt: model.updatedAt.getTime(),
  };
}

/**
 * Gets the cumulative EC change for a reservoir over a time period
 *
 * @param reservoirId - Reservoir ID
 * @param startMs - Start timestamp
 * @param endMs - End timestamp
 * @returns Cumulative EC change in mS/cm
 */
export async function getCumulativeEcChange(
  reservoirId: string,
  startMs: number,
  endMs: number
): Promise<number> {
  const events = await listEventsByDateRange(reservoirId, startMs, endMs);
  return events.reduce((sum, event) => sum + (event.deltaEc25c || 0), 0);
}

/**
 * Gets the cumulative pH change for a reservoir over a time period
 *
 * @param reservoirId - Reservoir ID
 * @param startMs - Start timestamp
 * @param endMs - End timestamp
 * @returns Cumulative pH change
 */
export async function getCumulativePhChange(
  reservoirId: string,
  startMs: number,
  endMs: number
): Promise<number> {
  const events = await listEventsByDateRange(reservoirId, startMs, endMs);
  return events.reduce((sum, event) => sum + (event.deltaPh || 0), 0);
}
