/**
 * Hook for managing strain adjustments
 *
 * Handles updating and retrieving per-phase pH/EC offsets
 */

import type { PlantPhase } from '@/lib/nutrient-engine/types';

export interface StrainAdjustment {
  phase: PlantPhase;
  phOffset: number;
  ecOffset: number;
}

interface UseStrainAdjustments {
  updateAdjustment: (
    phase: PlantPhase,
    field: 'phOffset' | 'ecOffset',
    value: number
  ) => void;
  getAdjustment: (phase: PlantPhase) => StrainAdjustment;
  hasAnyAdjustments: boolean;
}

export function useStrainAdjustments(
  adjustments: StrainAdjustment[],
  onAdjustmentsChange: (adjustments: StrainAdjustment[]) => void
): UseStrainAdjustments {
  const updateAdjustment = (
    phase: PlantPhase,
    field: 'phOffset' | 'ecOffset',
    value: number
  ) => {
    const existingIndex = adjustments.findIndex((a) => a.phase === phase);

    if (existingIndex >= 0) {
      const updated = [...adjustments];
      updated[existingIndex] = { ...updated[existingIndex], [field]: value };
      onAdjustmentsChange(updated);
    } else {
      onAdjustmentsChange([
        ...adjustments,
        {
          phase,
          phOffset: field === 'phOffset' ? value : 0,
          ecOffset: field === 'ecOffset' ? value : 0,
        },
      ]);
    }
  };

  const getAdjustment = (phase: PlantPhase): StrainAdjustment => {
    return (
      adjustments.find((a) => a.phase === phase) || {
        phase,
        phOffset: 0,
        ecOffset: 0,
      }
    );
  };

  const hasAnyAdjustments = adjustments.some(
    (a) => a.phOffset !== 0 || a.ecOffset !== 0
  );

  return { updateAdjustment, getAdjustment, hasAnyAdjustments };
}
