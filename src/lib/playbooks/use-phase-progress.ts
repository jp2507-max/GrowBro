/**
 * Phase Progress Hook
 *
 * React hook for accessing phase tracking functionality
 *
 * Requirements: 8.1-8.7
 */

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import type { Playbook } from '@/types/playbook';

import { checkUpcomingTransitions } from './phase-notifications';
import {
  computeCurrentPhase,
  getPhaseProgress,
  getPhaseSummary,
  type PhaseInfo,
  type PhaseProgress,
} from './phase-tracker';

export type UsePhaseProgressOptions = {
  plantId: string;
  playbookId: string;
  playbook: Playbook;
  plantStartDate: string;
  timezone: string;
  enabled?: boolean;
};

export type UsePhaseProgressResult = {
  phaseInfo: PhaseInfo | null;
  phaseProgress: PhaseProgress[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
};

/**
 * Hook to track phase progress for a plant with an applied playbook
 */
export function usePhaseProgress({
  plantId,
  playbookId,
  playbook,
  plantStartDate,
  timezone,
  enabled = true,
}: UsePhaseProgressOptions): UsePhaseProgressResult {
  const [phaseProgress, setPhaseProgress] = useState<PhaseProgress[]>([]);

  // Query current phase info
  const {
    data: phaseInfo,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['phase-info', plantId, playbookId],
    queryFn: async () => {
      const info = await computeCurrentPhase({
        plantId,
        playbookId,
        playbook,
        plantStartDate,
        timezone,
      });

      // Check for upcoming transitions and schedule notifications
      await checkUpcomingTransitions({
        plantId,
        playbookId,
        currentPhaseIndex: info.phaseIndex,
        phaseOrder: playbook.phaseOrder,
        phaseEndDate: info.phaseEndDate,
        timezone,
      });

      return info;
    },
    enabled,
    refetchInterval: 60000, // Refetch every minute
  });

  // Load phase progress when phase info changes
  useEffect(() => {
    if (!phaseInfo || !enabled) return;

    const loadProgress = async () => {
      const progress = await getPhaseProgress({
        plantId,
        playbookId,
        playbook,
        currentPhaseIndex: phaseInfo.phaseIndex,
        timezone,
      });
      setPhaseProgress(progress);
    };

    loadProgress();
  }, [phaseInfo, plantId, playbookId, playbook, timezone, enabled]);

  return {
    phaseInfo: phaseInfo ?? null,
    phaseProgress,
    isLoading,
    error: error as Error | null,
    refetch,
  };
}

export type UsePhaseSummaryOptions = {
  plantId: string;
  playbookId: string;
  phaseIndex: number;
  phase: string;
  enabled?: boolean;
};

/**
 * Hook to get summary for a completed phase
 */
export function usePhaseSummary(options: UsePhaseSummaryOptions) {
  const { plantId, playbookId, phaseIndex, phase, enabled = true } = options;

  return useQuery({
    queryKey: ['phase-summary', plantId, playbookId, phaseIndex],
    queryFn: () =>
      getPhaseSummary({
        plantId,
        playbookId,
        phaseIndex,
        phase: phase as any,
      }),
    enabled,
  });
}
