/**
 * Alert service for deviation alert lifecycle management
 *
 * Provides functions to trigger, acknowledge, resolve, and query alerts.
 * Integrates with WatermelonDB for persistence and offline support.
 */

import type { Database } from '@nozbe/watermelondb';
import { Q } from '@nozbe/watermelondb';

import { database } from '@/lib/watermelon';
import type { DeviationAlertModel } from '@/lib/watermelon-models/deviation-alert';
import type { PhEcReadingModel } from '@/lib/watermelon-models/ph-ec-reading';
import type { ReservoirModel } from '@/lib/watermelon-models/reservoir';

import type {
  DeviationAlert,
  GrowingMedium,
  PhEcReading,
  PpmScale,
  Reservoir,
} from '../types';
import { evaluateReadingAgainstTargets } from '../utils/alert-evaluation';

// ============================================================================
// Alert Creation and Triggering
// ============================================================================

/**
 * Evaluates a reading and triggers an alert if conditions are met
 * Returns the created alert model if triggered, null otherwise
 *
 * @param reading - The pH/EC reading to evaluate
 * @param reservoir - Reservoir configuration
 * @param userId - Optional user ID for alert ownership
 * @returns Promise<DeviationAlertModel | null>
 */
export async function evaluateAndTriggerAlert(
  reading: PhEcReadingModel,
  reservoir: ReservoirModel,
  userId?: string
): Promise<DeviationAlertModel | null> {
  const db = database;

  // Get recent readings for persistence check (last 10 minutes)
  const tenMinutesAgo = Date.now() - 10 * 60_000;
  const recentReadingsModels = await db
    .get<PhEcReadingModel>('ph_ec_readings_v2')
    .query(
      Q.where('reservoir_id', reservoir.id),
      Q.where('measured_at', Q.gte(tenMinutesAgo)),
      Q.sortBy('measured_at', Q.asc)
    )
    .fetch();

  // Convert models to type objects
  const recentReadings = recentReadingsModels.map(modelToReading);
  const currentReading = modelToReading(reading);
  const reservoirData = modelToReservoir(reservoir);

  // Get active alerts for cooldown check
  const activeAlertsModels = await getActiveAlerts(reservoir.id);
  const activeAlerts = activeAlertsModels.map(modelToAlert);

  // Evaluate if alert should be triggered
  const alertData = evaluateReadingAgainstTargets(
    currentReading,
    reservoirData,
    {
      recentReadings,
      activeAlerts,
    }
  );

  if (!alertData) {
    return null;
  }

  // Create alert in database
  const alertModel = await db.write(async () => {
    return db
      .get<DeviationAlertModel>('deviation_alerts_v2')
      .create((alert) => {
        alert.readingId = reading.id;
        alert.type = alertData.type;
        alert.severity = alertData.severity;
        alert.message = alertData.message;
        alert.recommendations = alertData.recommendations;
        alert.recommendationCodes = alertData.recommendationCodes;
        alert.cooldownUntil = alertData.cooldownUntil;
        alert.triggeredAt = alertData.triggeredAt;
        if (userId) {
          alert.userId = userId;
        }
      });
  });

  return alertModel;
}

/**
 * Creates an alert directly (for testing or manual creation)
 */
export async function createAlert(
  alertData: Omit<DeviationAlert, 'id' | 'createdAt' | 'updatedAt'>,
  userId?: string
): Promise<DeviationAlertModel> {
  const db = database;

  return db.write(async () => {
    return db
      .get<DeviationAlertModel>('deviation_alerts_v2')
      .create((alert) => {
        alert.readingId = alertData.readingId;
        alert.type = alertData.type;
        alert.severity = alertData.severity;
        alert.message = alertData.message;
        alert.recommendations = alertData.recommendations;
        alert.recommendationCodes = alertData.recommendationCodes;
        alert.cooldownUntil = alertData.cooldownUntil;
        alert.triggeredAt = alertData.triggeredAt;
        alert.acknowledgedAt = alertData.acknowledgedAt;
        alert.resolvedAt = alertData.resolvedAt;
        alert.deliveredAtLocal = alertData.deliveredAtLocal;
        if (userId) {
          alert.userId = userId;
        }
      });
  });
}

// ============================================================================
// Alert Lifecycle Management
// ============================================================================

/**
 * Acknowledges an alert by ID
 * Sets acknowledgedAt timestamp
 */
export async function acknowledgeAlert(
  alertId: string
): Promise<DeviationAlertModel> {
  const db = database;
  const alert = await db
    .get<DeviationAlertModel>('deviation_alerts_v2')
    .find(alertId);

  await alert.acknowledge();
  return alert;
}

/**
 * Resolves an alert by ID
 * Sets resolvedAt timestamp
 */
export async function resolveAlert(
  alertId: string
): Promise<DeviationAlertModel> {
  const db = database;
  const alert = await db
    .get<DeviationAlertModel>('deviation_alerts_v2')
    .find(alertId);

  await alert.resolve();
  return alert;
}

/**
 * Marks alert as delivered locally (for offline notifications)
 */
export async function markAlertDeliveredLocally(
  alertId: string
): Promise<DeviationAlertModel> {
  const db = database;
  const alert = await db
    .get<DeviationAlertModel>('deviation_alerts_v2')
    .find(alertId);

  await alert.markDeliveredLocally();
  return alert;
}

// ============================================================================
// Alert Queries
// ============================================================================

/**
 * Gets active (unresolved) alerts for a reservoir
 * Used for cooldown checking
 */
export async function getActiveAlerts(
  reservoirId: string
): Promise<DeviationAlertModel[]> {
  const db = database;

  // Get all readings for this reservoir
  const readings = await db
    .get<PhEcReadingModel>('ph_ec_readings_v2')
    .query(Q.where('reservoir_id', reservoirId))
    .fetch();

  const readingIds = readings.map((r) => r.id);

  if (readingIds.length === 0) {
    return [];
  }

  // Get alerts for these readings that are not resolved
  return db
    .get<DeviationAlertModel>('deviation_alerts_v2')
    .query(
      Q.where('reading_id', Q.oneOf(readingIds)),
      Q.where('resolved_at', null),
      Q.sortBy('triggered_at', Q.desc)
    )
    .fetch();
}

/**
 * Gets alert history for a reservoir within a time period
 *
 * @param reservoirId - Reservoir ID
 * @param days - Number of days to look back
 * @returns Promise<DeviationAlertModel[]>
 */
export async function getAlertHistory(
  reservoirId: string,
  days: number = 30
): Promise<DeviationAlertModel[]> {
  const db = database;
  const cutoffTime = Date.now() - days * 24 * 60 * 60_000;

  // Get all readings for this reservoir
  const readings = await db
    .get<PhEcReadingModel>('ph_ec_readings_v2')
    .query(Q.where('reservoir_id', reservoirId))
    .fetch();

  const readingIds = readings.map((r) => r.id);

  if (readingIds.length === 0) {
    return [];
  }

  return db
    .get<DeviationAlertModel>('deviation_alerts_v2')
    .query(
      Q.where('reading_id', Q.oneOf(readingIds)),
      Q.where('triggered_at', Q.gte(cutoffTime)),
      Q.sortBy('triggered_at', Q.desc)
    )
    .fetch();
}

/**
 * Gets all unacknowledged alerts across all reservoirs
 * Used for alert inbox/notification center
 */
export async function getUnacknowledgedAlerts(
  userId?: string
): Promise<DeviationAlertModel[]> {
  const db = database;
  const queries = [
    Q.where('acknowledged_at', null),
    Q.sortBy('triggered_at', Q.desc),
  ];

  if (userId) {
    queries.unshift(Q.where('user_id', userId));
  }

  return db
    .get<DeviationAlertModel>('deviation_alerts_v2')
    .query(...queries)
    .fetch();
}

/**
 * Gets alerts that were delivered offline and need sync
 * Used by sync worker to mirror offline alerts to server
 */
export async function getOfflineAlerts(): Promise<DeviationAlertModel[]> {
  const db = database;

  return db
    .get<DeviationAlertModel>('deviation_alerts_v2')
    .query(
      Q.where('delivered_at_local', Q.notEq(null)),
      Q.sortBy('delivered_at_local', Q.asc)
    )
    .fetch();
}

/**
 * Observes active alerts for a reservoir (reactive query)
 * Use this in React components with useObservable
 */
export function observeActiveAlerts(reservoirId: string, db?: Database): any {
  const db2 = db || database;

  // Note: This is a simplified version. For production, you'd need to properly
  // join with ph_ec_readings_v2 to filter by reservoir_id
  return db2
    .get<DeviationAlertModel>('deviation_alerts_v2')
    .query(Q.where('resolved_at', null), Q.sortBy('triggered_at', Q.desc))
    .observe();
}

// ============================================================================
// Helper Functions for Model Conversion
// ============================================================================

/**
 * Converts PhEcReadingModel to PhEcReading type
 */
function modelToReading(model: PhEcReadingModel): PhEcReading {
  return {
    id: model.id,
    plantId: model.plantId,
    reservoirId: model.reservoirId,
    measuredAt: model.measuredAt,
    ph: model.ph,
    ecRaw: model.ecRaw,
    ec25c: model.ec25c,
    tempC: model.tempC,
    atcOn: model.atcOn,
    ppmScale: model.ppmScale as PpmScale,
    meterId: model.meterId,
    note: model.note,
    qualityFlags: model.qualityFlags,
    createdAt: model.createdAt.getTime(),
    updatedAt: model.updatedAt.getTime(),
  };
}

/**
 * Converts ReservoirModel to Reservoir type
 */
function modelToReservoir(model: ReservoirModel): Reservoir {
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

/**
 * Converts DeviationAlertModel to DeviationAlert type
 */
function modelToAlert(model: DeviationAlertModel): DeviationAlert {
  return {
    id: model.id,
    readingId: model.readingId,
    type: model.type as DeviationAlert['type'],
    severity: model.severity as DeviationAlert['severity'],
    message: model.message,
    recommendations: model.recommendations,
    recommendationCodes: model.recommendationCodes,
    cooldownUntil: model.cooldownUntil,
    triggeredAt: model.triggeredAt,
    acknowledgedAt: model.acknowledgedAt,
    resolvedAt: model.resolvedAt,
    deliveredAtLocal: model.deliveredAtLocal,
    createdAt: model.createdAt.getTime(),
    updatedAt: model.updatedAt.getTime(),
  };
}
