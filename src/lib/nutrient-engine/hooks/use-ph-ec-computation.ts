/**
 * Hook for computing EC@25°C and quality metrics
 *
 * Handles temperature compensation, PPM conversion, quality flags, and confidence scoring
 */

import type { Calibration, PpmScale } from '@/lib/nutrient-engine/types';
import {
  calculateConfidenceScore,
  computeQualityFlags,
  ecToPpm,
  toEC25,
} from '@/lib/nutrient-engine/utils/conversions';

interface ComputedMetrics {
  ec25c: number | null;
  ppm: number | null;
  qualityFlags: string[];
  confidence: number;
}

interface UsePhEcComputationProps {
  ecRaw?: number;
  tempC?: number;
  atcOn?: boolean;
  ppmScale: PpmScale;
  calibration?: Calibration;
}

export function usePhEcComputation({
  ecRaw,
  tempC,
  atcOn,
  ppmScale,
  calibration,
}: UsePhEcComputationProps): ComputedMetrics {
  let ec25c: number | null = null;
  let ppm: number | null = null;
  let qualityFlags: string[] = [];
  let confidence = 1.0;

  try {
    if (ecRaw && tempC) {
      ec25c = atcOn ? ecRaw : toEC25(ecRaw, tempC);
      ppm = ecToPpm(ec25c, ppmScale);

      const mockReading = {
        ecRaw,
        tempC,
        atcOn,
        ec25c,
      } as any;

      qualityFlags = computeQualityFlags(mockReading, calibration);
      confidence = calculateConfidenceScore(mockReading, calibration);
    }
  } catch {
    // Invalid values, skip computation
  }

  return { ec25c, ppm, qualityFlags, confidence };
}
