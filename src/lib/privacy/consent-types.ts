export const RUNTIME_CONSENT_KEYS = [
  'telemetry',
  'experiments',
  'cloudProcessing',
  'aiTraining',
  'aiModelImprovement',
  'crashDiagnostics',
] as const;

export type ConsentPurpose = (typeof RUNTIME_CONSENT_KEYS)[number];

export const LAWFUL_BASIS = {
  CONSENT: 'consent-6.1.a',
  LEGITIMATE_INTERESTS: 'legitimate-interests-6.1.f',
} as const;

export type LawfulBasis = (typeof LAWFUL_BASIS)[keyof typeof LAWFUL_BASIS];

export const LAWFUL_BASIS_BY_PURPOSE: Record<ConsentPurpose, LawfulBasis> = {
  telemetry: LAWFUL_BASIS.CONSENT,
  experiments: LAWFUL_BASIS.CONSENT,
  cloudProcessing: LAWFUL_BASIS.CONSENT,
  aiTraining: LAWFUL_BASIS.CONSENT,
  aiModelImprovement: LAWFUL_BASIS.CONSENT,
  crashDiagnostics: LAWFUL_BASIS.CONSENT,
};

export type ConsentMetadata = {
  uiSurface: 'first-run' | 'settings' | 'feature-prompt';
  policyVersion: string;
  controllerIdentity: string;
  lawfulBasis: LawfulBasis;
  justificationId: string;
  region: string;
};

export type ConsentState = {
  telemetry: boolean;
  experiments: boolean;
  cloudProcessing: boolean;
  aiTraining: boolean;
  aiModelImprovement: boolean;
  crashDiagnostics: boolean;
  version: string;
  timestamp: string; // ISO string
  locale: string;
};

export type ConsentAuditLog = {
  id: string;
  action: 'grant' | 'withdraw' | 'update';
  purpose: ConsentPurpose;
  timestamp: string; // ISO
  metadata: ConsentMetadata;
};

export type ValidationResult = {
  isValid: boolean;
  reasons?: string[];
};
