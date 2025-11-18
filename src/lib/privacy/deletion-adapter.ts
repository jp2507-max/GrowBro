export type DeletionAdapter = {
  purgeInferenceImages(countHint?: number): Promise<number>;
  purgeTrainingImages(countHint?: number): Promise<number>;
};

const noop: DeletionAdapter = {
  async purgeInferenceImages() {
    return 0;
  },
  async purgeTrainingImages() {
    return 0;
  },
};

// Store the adapter on globalThis to ensure a single instance across
// jest.isolateModules and multiple imports in the same test run.
const GLOBAL_KEY = '__growbroDeletionAdapter__';

interface GlobalWithAdapter {
  [GLOBAL_KEY]?: DeletionAdapter;
}

const g = globalThis as typeof globalThis & GlobalWithAdapter;
if (!g[GLOBAL_KEY]) {
  g[GLOBAL_KEY] = noop as DeletionAdapter;
}

function getCurrent(): DeletionAdapter {
  return g[GLOBAL_KEY] as DeletionAdapter;
}

export function setDeletionAdapter(adapter: DeletionAdapter): void {
  g[GLOBAL_KEY] = adapter;
}

export function getDeletionAdapter(): DeletionAdapter {
  return getCurrent();
}
