/**
 * Hook for evaluating pH/EC readings and triggering alerts
 *
 * Provides a function to evaluate readings after creation and handle
 * alert notification delivery (online and offline scenarios).
 */

import { useCallback } from 'react';

import type { DeviationAlertModel } from '@/lib/watermelon-models/deviation-alert';
import type { PhEcReadingModel } from '@/lib/watermelon-models/ph-ec-reading';
import type { ReservoirModel } from '@/lib/watermelon-models/reservoir';

import {
  deliverOfflineAlert,
  scheduleAlertNotification,
} from '../services/alert-notification-service';
import {
  evaluateAndTriggerAlert,
  markAlertDeliveredLocally,
} from '../services/alert-service';
import type {
  AlertSeverity,
  AlertType,
  DeviationAlert,
  GrowingMedium,
  PhEcReading,
  PpmScale,
  QualityFlag,
  Reservoir,
} from '../types';

// ============================================================================
// Hook Return Type
// ============================================================================

export type UseAlertEvaluationReturn = {
  /**
   * Evaluates a reading and triggers alert if conditions met
   * Handles notification delivery for both online and offline scenarios
   *
   * @param options - Evaluation options
   * @returns Promise<DeviationAlertModel | null> - Created alert if triggered
   */
  evaluateReading: (options: {
    reading: PhEcReadingModel;
    reservoir: ReservoirModel;
    userId?: string;
    isOffline?: boolean;
  }) => Promise<DeviationAlertModel | null>;
};

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for alert evaluation on reading creation
 *
 * Usage:
 * ```tsx
 * const { evaluateReading } = useAlertEvaluation();
 *
 * // After creating a reading
 * const alert = await evaluateReading({ reading, reservoir, userId, isOffline });
 * if (alert) {
 *   // Alert was triggered and notification scheduled
 *   console.log('Alert triggered:', alert.type);
 * }
 * ```
 */
export function useAlertEvaluation(): UseAlertEvaluationReturn {
  const evaluateReading = useCallback(
    async (options: {
      reading: PhEcReadingModel;
      reservoir: ReservoirModel;
      userId?: string;
      isOffline?: boolean;
    }): Promise<DeviationAlertModel | null> => {
      const { reading, reservoir, userId, isOffline = false } = options;
      try {
        // Evaluate reading and create alert if needed
        const alert = await evaluateAndTriggerAlert(reading, reservoir, userId);

        if (!alert) {
          return null; // No alert triggered
        }

        // Convert models to types for notification service
        const alertData = modelToAlert(alert);
        const readingData = modelToReading(reading);
        const reservoirData = modelToReservoir(reservoir);

        // Handle notification delivery based on online/offline status
        if (isOffline) {
          // Offline: deliver notification and mark as delivered locally
          const delivered = await deliverOfflineAlert(
            alertData,
            readingData,
            reservoirData
          );

          if (delivered) {
            await markAlertDeliveredLocally(alert.id);
          }
        } else {
          // Online: schedule notification immediately
          await scheduleAlertNotification(
            alertData,
            readingData,
            reservoirData
          );
        }

        return alert;
      } catch (error) {
        console.error('Error evaluating reading for alerts:', error);
        // Don't throw - alert evaluation failures shouldn't block reading creation
        return null;
      }
    },
    []
  );

  return { evaluateReading };
}

// ============================================================================
// Helper Functions for Model Conversion
// ============================================================================

/**
 * Converts DeviationAlertModel to DeviationAlert type
 */
function modelToAlert(model: DeviationAlertModel): DeviationAlert {
  return {
    id: model.id,
    readingId: model.readingId,
    type: model.type as AlertType,
    severity: model.severity as AlertSeverity,
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
    qualityFlags: model.qualityFlags as QualityFlag[],
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
