// DPIA management and validation (Node/CI usage only)
// Keep this module isolated from React Native runtime (do not export via src/lib/index.tsx)

import * as fs from 'fs';

export type DPIAMitigation = {
  risk: string;
  severity: 'low' | 'medium' | 'high';
  mitigation: string;
  implemented: boolean;
};

export type DPIAConfig = {
  version: string;
  aiModelVersion: string;
  completedAt: string; // ISO string for portability
  signedOff: boolean;
  mitigations: DPIAMitigation[];
};

// Backwards-compatible helper used by tests and existing callers.
export function assertDPIAUpToDate(
  dpia: DPIAConfig,
  currentModelVersion: string
): void {
  if (!dpia.signedOff || dpia.aiModelVersion !== currentModelVersion) {
    // Keep the legacy message so existing tests that assert on this text continue to pass
    throw new Error('DPIA required for AI model version change');
  }
}

export function validateDPIAConfig(
  config: DPIAConfig,
  currentModelVersion: string
): void {
  if (!config) {
    throw new Error('DPIA config missing');
  }
  if (!config.signedOff) {
    throw new Error('DPIA required: config not signed off');
  }
  if (config.aiModelVersion !== currentModelVersion) {
    throw new Error(
      `DPIA required for AI model version change: ${config.aiModelVersion} -> ${currentModelVersion}`
    );
  }
}

// Convenience helper for CI usage. Reads docs/dpia.json by default.
export function loadDPIAConfig(path = 'docs/dpia.json'): DPIAConfig {
  const json = fs.readFileSync(path, 'utf8');
  const parsed = JSON.parse(json) as DPIAConfig;
  return parsed;
}

export function validateDPIA(path = 'docs/dpia.json'): void {
  const cfg = loadDPIAConfig(path);
  const current = process.env.AI_MODEL_VERSION || '';
  validateDPIAConfig(cfg, current);
}
