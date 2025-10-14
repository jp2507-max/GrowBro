/**
 * Hook for schedule adjustments
 *
 * Provides UI integration for proposing and applying feeding schedule adjustments.
 *
 * Requirements: 5.5, 5.6
 */

import * as React from 'react';

import { database } from '@/lib/watermelon';

import type {
  AdjustmentApplicationResult,
  AdjustmentProposal,
  ProposedAdjustment,
} from '../services/schedule-adjustment-service';
import {
  applyAdjustments,
  proposeAdjustments,
  revertAdjustments,
} from '../services/schedule-adjustment-service';
import type { DeviationAlert } from '../types';

export type UseScheduleAdjustmentsState = {
  isProposing: boolean;
  isApplying: boolean;
  proposal: AdjustmentProposal | null;
  applicationResult: AdjustmentApplicationResult | null;
  error: Error | null;
};

export type UseScheduleAdjustmentsReturn = {
  state: UseScheduleAdjustmentsState;
  proposeAdjustments: (
    alert: DeviationAlert,
    plantId: string,
    maxTasks?: number
  ) => Promise<AdjustmentProposal | null>;
  applyProposal: (
    proposals: ProposedAdjustment[]
  ) => Promise<AdjustmentApplicationResult | null>;
  revertAdjustments: () => Promise<boolean>;
  reset: () => void;
};

// Helper functions to reduce hook complexity
function handleError(error: unknown): Error {
  return error instanceof Error ? error : new Error('Unknown error');
}

function createInitialState(): UseScheduleAdjustmentsState {
  return {
    isProposing: false,
    isApplying: false,
    proposal: null,
    applicationResult: null,
    error: null,
  };
}

/**
 * Execute proposal logic
 */
async function executeProposeAdjustments(
  alert: DeviationAlert,
  plantId: string,
  maxTasks: number
): Promise<AdjustmentProposal | null> {
  return await proposeAdjustments(database, { alert, plantId, maxTasks });
}

/**
 * Execute apply adjustments logic
 */
async function executeApplyAdjustments(
  proposals: ProposedAdjustment[]
): Promise<AdjustmentApplicationResult> {
  return await applyAdjustments(database, proposals);
}

/**
 * Execute revert adjustments logic
 */
async function executeRevertAdjustments(
  undo: AdjustmentApplicationResult['undo']
): Promise<void> {
  await revertAdjustments(database, undo);
}

/**
 * Generic async operation wrapper with state management
 */
async function withStateUpdate<T>(options: {
  setState: React.Dispatch<React.SetStateAction<UseScheduleAdjustmentsState>>;
  loadingKey: 'isProposing' | 'isApplying';
  operation: () => Promise<T>;
  onSuccess: (result: T) => Partial<UseScheduleAdjustmentsState>;
}): Promise<T | null> {
  const { setState, loadingKey, operation, onSuccess } = options;
  setState((prev) => ({ ...prev, [loadingKey]: true, error: null }));
  try {
    const result = await operation();
    setState((prev) => ({
      ...prev,
      [loadingKey]: false,
      ...onSuccess(result),
    }));
    return result;
  } catch (error) {
    setState((prev) => ({
      ...prev,
      [loadingKey]: false,
      error: handleError(error),
    }));
    return null;
  }
}

/**
 * Hook for managing feeding schedule adjustments
 *
 * Handles proposal generation, application, and undo functionality.
 *
 * @example
 * ```tsx
 * const { state, proposeAdjustments, applyProposal, revertAdjustments } =
 *   useScheduleAdjustments();
 *
 * const handleDeviation = async (alert: DeviationAlert) => {
 *   const proposal = await proposeAdjustments(alert, plantId);
 *
 *   if (proposal && proposal.canApply) {
 *     // Show confirmation modal
 *     const confirmed = await showAdjustmentModal(proposal);
 *
 *     if (confirmed) {
 *       const result = await applyProposal(proposal.proposedAdjustments);
 *       showMessage({ message: `Updated ${result.tasksUpdated} tasks` });
 *     }
 *   }
 * };
 * ```
 */
export function useScheduleAdjustments(): UseScheduleAdjustmentsReturn {
  const [state, setState] =
    React.useState<UseScheduleAdjustmentsState>(createInitialState);

  const proposeAdjustmentsFn = React.useCallback(
    async (
      alert: DeviationAlert,
      plantId: string,
      maxTasks: number = 3
    ): Promise<AdjustmentProposal | null> => {
      return withStateUpdate({
        setState,
        loadingKey: 'isProposing',
        operation: () => executeProposeAdjustments(alert, plantId, maxTasks),
        onSuccess: (proposal) => ({ proposal }),
      });
    },
    []
  );

  const applyProposal = React.useCallback(
    async (
      proposals: ProposedAdjustment[]
    ): Promise<AdjustmentApplicationResult | null> => {
      return withStateUpdate({
        setState,
        loadingKey: 'isApplying',
        operation: () => executeApplyAdjustments(proposals),
        onSuccess: (applicationResult) => ({ applicationResult }),
      });
    },
    []
  );

  const revertAdjustmentsFn = React.useCallback(async (): Promise<boolean> => {
    if (!state.applicationResult?.undo) return false;
    const result = await withStateUpdate({
      setState,
      loadingKey: 'isApplying',
      operation: () => executeRevertAdjustments(state.applicationResult!.undo),
      onSuccess: () => ({ applicationResult: null }),
    });
    return result !== null;
  }, [state.applicationResult]);

  const reset = React.useCallback(() => {
    setState(createInitialState());
  }, []);

  return {
    state,
    proposeAdjustments: proposeAdjustmentsFn,
    applyProposal,
    revertAdjustments: revertAdjustmentsFn,
    reset,
  };
}
