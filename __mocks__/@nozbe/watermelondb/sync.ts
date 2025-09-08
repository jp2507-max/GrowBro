export const hasUnsyncedChanges = jest.fn(async () => false);

type PullArgs = {
  lastPulledAt: number | null;
  schemaVersion: number;
  migration: any;
};

type PushArgs = {
  changes: any;
  lastPulledAt: number | null;
};

type SyncArgs = {
  database?: any;
  pullChanges: (args: PullArgs) => Promise<{ changes: any; timestamp: number }>;
  pushChanges?: (args: PushArgs) => Promise<void>;
  migrationsEnabledAtVersion?: number;
};

export async function synchronize(args: SyncArgs): Promise<void> {
  // Simulate a minimal push -> pull cycle without accessing native code
  if (args.pushChanges) {
    await args.pushChanges({ changes: {}, lastPulledAt: 0 });
  }
  await args.pullChanges({
    lastPulledAt: 0,
    schemaVersion: args.migrationsEnabledAtVersion ?? 0,
    migration: {},
  });
}

export default { synchronize, hasUnsyncedChanges };
