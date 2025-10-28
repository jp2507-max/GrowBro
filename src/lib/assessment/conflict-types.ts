export type ConflictResolutionStrategy =
  | 'last-write-wins'
  | 'client-wins'
  | 'server-wins';

export type SyncConflict<T = any> = {
  localData: T;
  serverData: T;
  localTimestamp: number;
  serverTimestamp: number;
};

export type ConflictResolution<T = any> = {
  resolved: T;
  strategy: ConflictResolutionStrategy;
  winner: 'local' | 'server';
  conflicts: string[];
};
