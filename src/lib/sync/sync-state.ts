import { create } from 'zustand';

import { createSelectors } from '@/lib/utils';

export type SyncState = {
  syncInFlight: boolean;

  setSyncInFlight: (value: boolean) => void;
};

const _useSyncState = create<SyncState>((set) => ({
  syncInFlight: false,

  setSyncInFlight: (value) => {
    set({ syncInFlight: value });
  },
}));

export const useSyncState = createSelectors(_useSyncState);

export function getSyncState(): SyncState {
  return _useSyncState.getState();
}
