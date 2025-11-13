export type ConflictResolutionStrategy =
  | 'last-write-wins'
  | 'client-wins'
  | 'server-wins';

export type SyncConflict<T = Record<string, unknown>> = {
  localData: T;
  serverData: T;
  localTimestamp: number;
  serverTimestamp: number;
};

export type ConflictResolution<T = Record<string, unknown>> = {
  resolved: T;
  strategy: ConflictResolutionStrategy;
  winner: 'local' | 'server';
  conflicts: string[];
};
