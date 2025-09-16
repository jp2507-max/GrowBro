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

let currentAdapter: DeletionAdapter = noop;

export function setDeletionAdapter(adapter: DeletionAdapter): void {
  currentAdapter = adapter;
}

export function getDeletionAdapter(): DeletionAdapter {
  return currentAdapter;
}
