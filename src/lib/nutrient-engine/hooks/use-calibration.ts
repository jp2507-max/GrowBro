/**
 * React hooks for calibration management
 *
 * Provides hooks for accessing and managing meter calibrations,
 * including validation status and reminder scheduling.
 *
 * Requirements: 2.7, 2.9, 8.4
 */

import { useEffect, useState } from 'react';

import type { CalibrationModel } from '@/lib/watermelon-models/calibration';

import { scheduleCalibrationReminders } from '../services/calibration-reminder';
import {
  getActiveCalibration,
  getCalibrationHistory,
  observeActiveCalibration,
  recordCalibration as recordCalibrationService,
  validateCalibration,
} from '../services/calibration-service';
import type { CalibrationStatus, CalibrationType } from '../types';

/**
 * Hook to get and observe active calibration for a meter
 *
 * @param meterId - Meter ID
 * @param type - Calibration type (ph or ec)
 * @returns Active calibration or null
 */
export function useActiveCalibration(
  meterId: string,
  type: CalibrationType
): CalibrationModel | null {
  const [calibration, setCalibration] = useState<CalibrationModel | null>(null);

  useEffect(() => {
    let subscription: any;

    const loadAndObserve = async () => {
      // Load initial data
      const active = await getActiveCalibration(meterId, type);
      setCalibration(active);

      // Observe changes
      subscription = observeActiveCalibration(meterId, type).subscribe(
        (calibrations: CalibrationModel[]) => {
          setCalibration(calibrations.length > 0 ? calibrations[0] : null);
        }
      );
    };

    void loadAndObserve();

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [meterId, type]);

  return calibration;
}

/**
 * Hook to get calibration validation status
 *
 * @param meterId - Meter ID
 * @param type - Calibration type
 * @returns Calibration status
 */
export function useCalibrationStatus(
  meterId: string,
  type: CalibrationType
): CalibrationStatus {
  const [status, setStatus] = useState<CalibrationStatus>({
    isValid: false,
    daysUntilExpiry: -999,
    lastCalibrationDate: 0,
    needsCalibration: true,
  });

  useEffect(() => {
    const loadStatus = async () => {
      const validationStatus = await validateCalibration(meterId, type);
      setStatus(validationStatus);
    };

    void loadStatus();

    // Refresh status every minute to keep it current
    const interval = setInterval(loadStatus, 60_000);

    return () => {
      clearInterval(interval);
    };
  }, [meterId, type]);

  return status;
}

/**
 * Hook to get calibration history for a meter
 *
 * @param meterId - Meter ID
 * @param type - Optional calibration type filter
 * @param limit - Maximum number of records
 * @returns Array of calibration models
 */
export function useCalibrationHistory(
  meterId: string,
  type?: CalibrationType,
  limit: number = 10
): CalibrationModel[] {
  const [history, setHistory] = useState<CalibrationModel[]>([]);

  useEffect(() => {
    const loadHistory = async () => {
      const calibrations = await getCalibrationHistory(meterId, type, limit);
      setHistory(calibrations);
    };

    void loadHistory();
  }, [meterId, type, limit]);

  return history;
}

/**
 * Hook to record a new calibration
 * Returns a function to record calibration with automatic reminder scheduling
 *
 * @returns Record calibration function
 */
export function useRecordCalibration(): {
  recordCalibration: typeof recordCalibrationService;
  isRecording: boolean;
  error: Error | null;
} {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const recordCalibration: typeof recordCalibrationService = async (
    data,
    userId
  ) => {
    setIsRecording(true);
    setError(null);

    try {
      const calibrationModel = await recordCalibrationService(data, userId);

      // Schedule reminders for the new calibration
      await scheduleCalibrationReminders(calibrationModel);

      return calibrationModel;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      throw error;
    } finally {
      setIsRecording(false);
    }
  };

  return {
    recordCalibration,
    isRecording,
    error,
  };
}

/**
 * Hook to check if multiple meters need calibration
 * Useful for dashboard/overview screens
 *
 * @param meters - Array of meter IDs with types
 * @returns Map of meter IDs to calibration status
 */
export function useBulkCalibrationStatus(
  meters: { id: string; type: CalibrationType }[]
): Map<string, CalibrationStatus> {
  const [statusMap, setStatusMap] = useState<Map<string, CalibrationStatus>>(
    new Map()
  );

  useEffect(() => {
    const loadAllStatuses = async () => {
      const newMap = new Map<string, CalibrationStatus>();

      for (const meter of meters) {
        const status = await validateCalibration(meter.id, meter.type);
        newMap.set(meter.id, status);
      }

      setStatusMap(newMap);
    };

    void loadAllStatuses();

    // Refresh every 5 minutes
    const interval = setInterval(loadAllStatuses, 5 * 60_000);

    return () => {
      clearInterval(interval);
    };
  }, [meters]);

  return statusMap;
}
