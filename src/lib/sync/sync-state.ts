import { create } from 'zustand';

import { createSelectors } from '@/lib/utils';

export type SyncState = {
  syncInFlight: boolean;
  pipelineInFlight: boolean;

  setSyncInFlight: (value: boolean) => void;
  setPipelineInFlight: (value: boolean) => void;
};

const _useSyncState = create<SyncState>((set) => ({
  syncInFlight: false,
  pipelineInFlight: false,

  setSyncInFlight: (value) => {
    set({ syncInFlight: value });
  },
  setPipelineInFlight: (value) => {
    set({ pipelineInFlight: value });
  },
}));

export const useSyncState = createSelectors(_useSyncState);

export function getSyncState(): SyncState {
  return _useSyncState.getState();
}
