import { getLocales } from 'expo-localization';

import type {
  ConsentAuditLog,
  ConsentMetadata,
  ConsentPurpose,
  ConsentState,
  ValidationResult,
} from './consent-types';
import { LAWFUL_BASIS_BY_PURPOSE } from './consent-types';
import {
  getSecureConfig,
  removeSecureConfig,
  setSecureConfig,
} from './secure-config-store';

const CONSENT_KEY = 'consents.v1';
const AUDIT_KEY = 'consents.audit.v1';
const CURRENT_CONSENT_VERSION = '2025-09-01';

function nowIso(): string {
  return new Date().toISOString();
}

function getLocale(): string {
  try {
    const first = getLocales?.()[0];
    if (first && typeof first.languageTag === 'string')
      return first.languageTag;
  } catch {}
  return 'en';
}

export type ConsentChangeListener = (state: ConsentState) => void;

export class ConsentServiceImpl {
  private listeners: Set<ConsentChangeListener> = new Set();

  private cache: ConsentState | null = null;

  private auditCache: ConsentAuditLog[] | null = null;

  constructor() {
    void this.hydrateCache();
  }

  async getConsents(): Promise<ConsentState> {
    if (this.cache && this.cache.version === CURRENT_CONSENT_VERSION) {
      return this.cache;
    }
    const stored = await getSecureConfig<ConsentState>(CONSENT_KEY);
    if (stored && stored.version === CURRENT_CONSENT_VERSION) {
      this.cache = stored;
      return stored;
    }
    if (stored && stored.version !== CURRENT_CONSENT_VERSION) {
      await removeSecureConfig(CONSENT_KEY);
    }
    const fresh: ConsentState = {
      telemetry: false,
      experiments: false,
      cloudProcessing: false,
      aiTraining: false,
      aiModelImprovement: false,
      crashDiagnostics: false,
      version: CURRENT_CONSENT_VERSION,
      timestamp: nowIso(),
      locale: getLocale(),
    };
    await setSecureConfig(CONSENT_KEY, fresh);
    this.cache = fresh;
    return fresh;
  }

  hasConsent(purpose: ConsentPurpose): boolean {
    if (!this.cache || this.cache.version !== CURRENT_CONSENT_VERSION)
      return false;
    return this.cache[purpose] === true;
  }

  async setConsent(
    purpose: ConsentPurpose,
    value: boolean,
    metadata?: ConsentMetadata
  ): Promise<void> {
    const current = await this.getConsents();
    const next: ConsentState = {
      ...current,
      [purpose]: value,
      version: CURRENT_CONSENT_VERSION,
      timestamp: nowIso(),
      locale: getLocale(),
    };
    await setSecureConfig(CONSENT_KEY, next);
    this.cache = next;
    await this.appendAudit({
      action: value ? 'grant' : 'withdraw',
      purpose,
      metadata: metadata ?? this.defaultMetadata(purpose),
    });
    this.emit(next);
  }

  /**
   * Atomically set multiple consents in a single read-modify-write.
   * This avoids the race where multiple concurrent setConsent calls
   * would each read the same snapshot and overwrite each other.
   */
  async setConsents(
    consents: Partial<Record<ConsentPurpose, boolean>>,
    metadata?: ConsentMetadata
  ): Promise<void> {
    const current = await this.getConsents();
    // Build the new state by applying provided consent changes
    const next: ConsentState = {
      ...current,
      ...consents,
      version: CURRENT_CONSENT_VERSION,
      timestamp: nowIso(),
      locale: getLocale(),
    };

    // Persist once
    await setSecureConfig(CONSENT_KEY, next);
    this.cache = next;

    // Append audit entries for each purpose that changed
    const entries: {
      action: 'grant' | 'withdraw';
      purpose: ConsentPurpose;
      metadata: ConsentMetadata;
    }[] = [];

    for (const purpose of Object.keys(consents) as ConsentPurpose[]) {
      const newVal = consents[purpose];
      // Only audit explicit boolean changes
      if (typeof newVal === 'boolean') {
        entries.push({
          action: newVal ? 'grant' : 'withdraw',
          purpose,
          metadata: metadata ?? this.defaultMetadata(purpose),
        });
      }
    }

    for (const e of entries) {
      // appendAudit is async but we intentionally await each entry so tests
      // and callers can observe audit rows after this method completes.
      await this.appendAudit({
        action: e.action,
        purpose: e.purpose,
        metadata: e.metadata,
      });
    }

    // Emit the new consolidated state once
    this.emit(next);
  }

  async withdrawConsent(
    purpose: ConsentPurpose,
    reason?: string
  ): Promise<void> {
    const meta = this.defaultMetadata(purpose);
    const nextMeta: ConsentMetadata = {
      ...meta,
      justificationId: reason ?? meta.justificationId,
    };
    await this.setConsent(purpose, false, nextMeta);
  }

  onChange(callback: ConsentChangeListener): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  isConsentRequired(): boolean {
    if (!this.cache || this.cache.version !== CURRENT_CONSENT_VERSION) {
      return true;
    }
    return false;
  }

  getConsentVersion(): string {
    return this.cache?.version ?? CURRENT_CONSENT_VERSION;
  }

  isSDKAllowed(_sdkName: string): boolean {
    // Placeholder; gating handled elsewhere. For now, return crash consent for crash SDKs, telemetry for analytics.
    return false;
  }

  async exportConsentHistory(): Promise<ConsentAuditLog[]> {
    if (this.auditCache) return [...this.auditCache];
    const stored = await getSecureConfig<ConsentAuditLog[]>(AUDIT_KEY);
    if (Array.isArray(stored)) {
      this.auditCache = stored;
      return [...stored];
    }
    this.auditCache = [];
    return [];
  }

  async validateConsents(): Promise<ValidationResult> {
    const issues: string[] = [];
    // Lawful basis mapping must exist for every purpose
    for (const purpose of Object.keys(
      LAWFUL_BASIS_BY_PURPOSE
    ) as ConsentPurpose[]) {
      if (!LAWFUL_BASIS_BY_PURPOSE[purpose])
        issues.push(`missing-lawful-basis:${purpose}`);
    }
    return {
      isValid: issues.length === 0,
      reasons: issues.length ? issues : undefined,
    };
  }

  private emit(state: ConsentState): void {
    for (const cb of this.listeners) {
      try {
        cb(state);
      } catch {
        // ignore listener errors
      }
    }
  }

  private defaultMetadata(purpose: ConsentPurpose): ConsentMetadata {
    return {
      uiSurface: 'settings',
      policyVersion: CURRENT_CONSENT_VERSION,
      controllerIdentity: 'GrowBro',
      lawfulBasis: LAWFUL_BASIS_BY_PURPOSE[purpose],
      justificationId: 'POL-GBR-2025-001',
      region: 'EU',
    };
  }

  private async appendAudit(
    entry: Omit<ConsentAuditLog, 'id' | 'timestamp'>
  ): Promise<void> {
    if (!this.auditCache) {
      const stored = await getSecureConfig<ConsentAuditLog[]>(AUDIT_KEY);
      this.auditCache = Array.isArray(stored) ? stored : [];
    }
    const existing = this.auditCache ?? [];
    const log: ConsentAuditLog = {
      id: String(existing.length + 1),
      timestamp: nowIso(),
      ...entry,
    };
    const next = [...existing, log];
    this.auditCache = next;
    await setSecureConfig(AUDIT_KEY, next);
  }

  private async hydrateCache(): Promise<void> {
    const stored = await getSecureConfig<ConsentState>(CONSENT_KEY);
    if (stored && stored.version === CURRENT_CONSENT_VERSION) {
      this.cache = stored;
    }
  }

  /** @internal test helper */
  resetForTests(): void {
    this.cache = null;
    this.auditCache = null;
  }
}

export const ConsentService = new ConsentServiceImpl();
