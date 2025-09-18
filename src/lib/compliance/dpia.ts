export type DPIAConfig = {
  version: string;
  aiModelVersion: string;
  completedAt: string; // ISO string for portability in tests
  signedOff: boolean;
};

export function assertDPIAUpToDate(
  dpia: DPIAConfig,
  currentModelVersion: string
): void {
  if (!dpia.signedOff || dpia.aiModelVersion !== currentModelVersion) {
    throw new Error('DPIA required for AI model version change');
  }
}
