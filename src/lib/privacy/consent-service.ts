import { getLocales } from 'expo-localization';

import { getItem, setItem } from '@/lib/storage';

import type {
  ConsentAuditLog,
  ConsentMetadata,
  ConsentPurpose,
  ConsentState,
  ValidationResult,
} from './consent-types';
import { LAWFUL_BASIS_BY_PURPOSE } from './consent-types';

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

  getConsents(): Promise<ConsentState> {
    const stored = getItem<ConsentState>(CONSENT_KEY);
    if (stored) return Promise.resolve(stored);
    const fresh: ConsentState = {
      telemetry: false,
      experiments: false,
      aiTraining: false,
      crashDiagnostics: false,
      version: CURRENT_CONSENT_VERSION,
      timestamp: nowIso(),
      locale: getLocale(),
    };
    setItem(CONSENT_KEY, fresh);
    return Promise.resolve(fresh);
  }

  hasConsent(purpose: ConsentPurpose): boolean {
    const state = getItem<ConsentState>(CONSENT_KEY);
    if (!state) return false;
    return state[purpose] === true;
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
    setItem(CONSENT_KEY, next);
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
    setItem(CONSENT_KEY, next);

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
    const state = getItem<ConsentState>(CONSENT_KEY);
    return !state || state.version !== CURRENT_CONSENT_VERSION;
  }

  getConsentVersion(): string {
    const state = getItem<ConsentState>(CONSENT_KEY);
    return state?.version ?? CURRENT_CONSENT_VERSION;
  }

  isSDKAllowed(_sdkName: string): boolean {
    // Placeholder; gating handled elsewhere. For now, return crash consent for crash SDKs, telemetry for analytics.
    return false;
  }

  async exportConsentHistory(): Promise<ConsentAuditLog[]> {
    return getItem<ConsentAuditLog[]>(AUDIT_KEY) ?? [];
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
    const existing = getItem<ConsentAuditLog[]>(AUDIT_KEY) ?? [];
    const log: ConsentAuditLog = {
      id: String(existing.length + 1),
      timestamp: nowIso(),
      ...entry,
    };
    setItem(AUDIT_KEY, [...existing, log]);
  }
}

export const ConsentService = new ConsentServiceImpl();
