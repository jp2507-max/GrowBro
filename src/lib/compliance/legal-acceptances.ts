import { Env } from '@env';
import { getLocales } from 'expo-localization';
import type { StoreApi } from 'zustand';
import { create } from 'zustand';

import { useAuth } from '@/lib/auth';
import { storage } from '@/lib/storage';
import { createSelectors } from '@/lib/utils';
import type { LegalDocumentType } from '@/types/settings';

export type { LegalDocumentType } from '@/types/settings';

function getLocale(): string {
  try {
    const first = getLocales?.()[0];
    if (first && typeof first.languageTag === 'string')
      return first.languageTag;
  } catch {}
  return 'en';
}

const LEGAL_ACCEPTANCES_KEY = 'compliance.legal.acceptances';

export type LegalDocumentVersion = {
  version: string;
  lastUpdated: string;
};

export type LegalAcceptance = {
  documentType: LegalDocumentType;
  accepted: boolean;
  acceptedAt: string | null;
  acceptedVersion: string | null;
  ipAddress?: string; // Server-side only, with consent
};

type PersistedLegalState = {
  acceptances: Record<LegalDocumentType, LegalAcceptance>;
  lastUpdated: string;
};

type LegalAcceptanceSnapshot = {
  userId: string | null;
  acceptances: Record<LegalDocumentType, LegalAcceptance>;
  appVersion: string;
  locale: string;
  lastUpdated: string;
};

export type LegalAcceptancesStoreState = {
  acceptances: Record<LegalDocumentType, LegalAcceptance>;
  lastUpdated: string | null;
  hydrate: () => void;
  acceptDocument: (documentType: LegalDocumentType, version: string) => void;
  acceptAll: (versions: Record<LegalDocumentType, string>) => void;
  reset: () => void;
  isAllAccepted: () => boolean;
  needsReAcceptance: (
    documentType: LegalDocumentType,
    currentVersion: string
  ) => boolean;
  getAcceptedVersion: (documentType: LegalDocumentType) => string | null;
};

// Default current versions - these should match the actual document versions
const CURRENT_VERSIONS: Record<LegalDocumentType, LegalDocumentVersion> = {
  terms: { version: '1.0.0', lastUpdated: new Date().toISOString() },
  privacy: { version: '1.0.0', lastUpdated: new Date().toISOString() },
  cannabis: { version: '1.0.0', lastUpdated: new Date().toISOString() },
};

function loadPersistedAcceptances(): PersistedLegalState {
  try {
    const raw = storage.getString(LEGAL_ACCEPTANCES_KEY);
    if (!raw) {
      return createEmptyState();
    }
    const parsed = JSON.parse(raw) as PersistedLegalState;
    // Validate structure
    if (!parsed.acceptances || typeof parsed.acceptances !== 'object') {
      return createEmptyState();
    }
    return {
      acceptances: parsed.acceptances,
      lastUpdated:
        typeof parsed.lastUpdated === 'string'
          ? parsed.lastUpdated
          : new Date().toISOString(),
    };
  } catch {
    return createEmptyState();
  }
}

function createEmptyState(): PersistedLegalState {
  return {
    acceptances: {
      terms: {
        documentType: 'terms',
        accepted: false,
        acceptedAt: null,
        acceptedVersion: null,
      },
      privacy: {
        documentType: 'privacy',
        accepted: false,
        acceptedAt: null,
        acceptedVersion: null,
      },
      cannabis: {
        documentType: 'cannabis',
        accepted: false,
        acceptedAt: null,
        acceptedVersion: null,
      },
    },
    lastUpdated: new Date().toISOString(),
  };
}

function savePersistedAcceptances(state: PersistedLegalState): boolean {
  try {
    storage.set(LEGAL_ACCEPTANCES_KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    console.error(
      `Failed to save legal acceptances for key "${LEGAL_ACCEPTANCES_KEY}":`,
      error
    );
    return false;
  }
}

function parseVersion(version: string): {
  major: number;
  minor: number;
  patch: number;
} {
  const parts = version.split('.').map((p) => parseInt(p, 10));
  return {
    major: parts[0] || 0,
    minor: parts[1] || 0,
    patch: parts[2] || 0,
  };
}

function isMajorVersionBump(
  acceptedVersion: string,
  currentVersion: string
): boolean {
  const accepted = parseVersion(acceptedVersion);
  const current = parseVersion(currentVersion);
  return current.major > accepted.major;
}

function isMinorOrPatchBump(
  acceptedVersion: string,
  currentVersion: string
): boolean {
  const accepted = parseVersion(acceptedVersion);
  const current = parseVersion(currentVersion);
  if (current.major > accepted.major) return false;
  if (current.major < accepted.major) return false;
  return current.minor > accepted.minor || current.patch > accepted.patch;
}

function createHydrateFunction(
  set: StoreApi<LegalAcceptancesStoreState>['setState']
): () => void {
  return () => {
    const persisted = loadPersistedAcceptances();
    set({
      acceptances: persisted.acceptances,
      lastUpdated: persisted.lastUpdated,
    });
  };
}

function createAcceptDocumentFunction(
  set: StoreApi<LegalAcceptancesStoreState>['setState'],
  get: StoreApi<LegalAcceptancesStoreState>['getState']
): (documentType: LegalDocumentType, version: string) => void {
  return (documentType: LegalDocumentType, version: string) => {
    const state = get();
    const timestamp = new Date().toISOString();
    const updatedAcceptances = {
      ...state.acceptances,
      [documentType]: {
        documentType,
        accepted: true,
        acceptedAt: timestamp,
        acceptedVersion: version,
      },
    };
    set({
      acceptances: updatedAcceptances,
      lastUpdated: timestamp,
    });
    const saved = savePersistedAcceptances({
      acceptances: updatedAcceptances,
      lastUpdated: timestamp,
    });
    if (!saved) {
      // Storage failure - could surface to user via toast/error state
      console.warn('Failed to persist legal document acceptance locally');
    }
  };
}

function createAcceptAllFunction(
  set: StoreApi<LegalAcceptancesStoreState>['setState']
): (versions: Record<LegalDocumentType, string>) => void {
  return (versions: Record<LegalDocumentType, string>) => {
    const timestamp = new Date().toISOString();
    const acceptances: Record<LegalDocumentType, LegalAcceptance> = {
      terms: {
        documentType: 'terms',
        accepted: true,
        acceptedAt: timestamp,
        acceptedVersion: versions.terms,
      },
      privacy: {
        documentType: 'privacy',
        accepted: true,
        acceptedAt: timestamp,
        acceptedVersion: versions.privacy,
      },
      cannabis: {
        documentType: 'cannabis',
        accepted: true,
        acceptedAt: timestamp,
        acceptedVersion: versions.cannabis,
      },
    };
    set({
      acceptances,
      lastUpdated: timestamp,
    });
    const saved = savePersistedAcceptances({
      acceptances,
      lastUpdated: timestamp,
    });
    if (!saved) {
      // Storage failure - could surface to user via toast/error state
      console.warn('Failed to persist all legal document acceptances locally');
    }
  };
}

function createResetFunction(
  set: StoreApi<LegalAcceptancesStoreState>['setState']
): () => void {
  return () => {
    storage.delete(LEGAL_ACCEPTANCES_KEY);
    const emptyState = createEmptyState();
    set({
      acceptances: emptyState.acceptances,
      lastUpdated: emptyState.lastUpdated,
    });
  };
}

function createIsAllAcceptedFunction(
  get: StoreApi<LegalAcceptancesStoreState>['getState']
): () => boolean {
  return () => {
    const state = get();
    const types: LegalDocumentType[] = ['terms', 'privacy', 'cannabis'];
    return types.every((type) => state.acceptances[type]?.accepted === true);
  };
}

function createNeedsReAcceptanceFunction(
  get: StoreApi<LegalAcceptancesStoreState>['getState']
): (documentType: LegalDocumentType, currentVersion: string) => boolean {
  return (documentType: LegalDocumentType, currentVersion: string) => {
    const state = get();
    const acceptance = state.acceptances[documentType];
    if (!acceptance || !acceptance.accepted || !acceptance.acceptedVersion) {
      return true;
    }
    return isMajorVersionBump(acceptance.acceptedVersion, currentVersion);
  };
}

function createGetAcceptedVersionFunction(
  get: StoreApi<LegalAcceptancesStoreState>['getState']
): (documentType: LegalDocumentType) => string | null {
  return (documentType: LegalDocumentType) => {
    const state = get();
    return state.acceptances[documentType]?.acceptedVersion ?? null;
  };
}

function createLegalAcceptancesStore(
  set: StoreApi<LegalAcceptancesStoreState>['setState'],
  get: StoreApi<LegalAcceptancesStoreState>['getState']
): LegalAcceptancesStoreState {
  const emptyState = createEmptyState();
  return {
    acceptances: emptyState.acceptances,
    lastUpdated: null,
    hydrate: createHydrateFunction(set),
    acceptDocument: createAcceptDocumentFunction(set, get),
    acceptAll: createAcceptAllFunction(set),
    reset: createResetFunction(set),
    isAllAccepted: createIsAllAcceptedFunction(get),
    needsReAcceptance: createNeedsReAcceptanceFunction(get),
    getAcceptedVersion: createGetAcceptedVersionFunction(get),
  };
}

const _useLegalAcceptances = create<LegalAcceptancesStoreState>((set, get) =>
  createLegalAcceptancesStore(set, get)
);

const legalAcceptancesStore = createSelectors(_useLegalAcceptances);

export const useLegalAcceptances = legalAcceptancesStore.use;
export { legalAcceptancesStore };

export function hydrateLegalAcceptances(): void {
  legalAcceptancesStore.getState().hydrate();
}

export function acceptLegalDocument(
  documentType: LegalDocumentType,
  version: string
): void {
  legalAcceptancesStore.getState().acceptDocument(documentType, version);
}

export function acceptAllLegalDocuments(
  versions: Record<LegalDocumentType, string>
): void {
  legalAcceptancesStore.getState().acceptAll(versions);
}

export function resetLegalAcceptances(): void {
  legalAcceptancesStore.getState().reset();
}

export function isAllLegalAccepted(): boolean {
  return legalAcceptancesStore.getState().isAllAccepted();
}

export function needsLegalReAcceptance(
  documentType: LegalDocumentType,
  currentVersion: string
): boolean {
  return legalAcceptancesStore
    .getState()
    .needsReAcceptance(documentType, currentVersion);
}

export function getAcceptedLegalVersion(
  documentType: LegalDocumentType
): string | null {
  return legalAcceptancesStore.getState().getAcceptedVersion(documentType);
}

export function getCurrentLegalVersions(): Record<
  LegalDocumentType,
  LegalDocumentVersion
> {
  return CURRENT_VERSIONS;
}

export function getLegalAcceptanceSnapshot(): LegalAcceptanceSnapshot {
  const state = legalAcceptancesStore.getState();
  return {
    userId: useAuth.getState().user?.id ?? null,
    acceptances: state.acceptances,
    appVersion: Env.VERSION,
    locale: getLocale(),
    lastUpdated: state.lastUpdated ?? new Date().toISOString(),
  };
}

export function checkLegalVersionBumps(
  currentVersionsOverride?: Record<LegalDocumentType, LegalDocumentVersion>
): {
  needsBlocking: boolean;
  needsNotification: boolean;
  documents: LegalDocumentType[];
} {
  const state = legalAcceptancesStore.getState();
  const currentVersions = currentVersionsOverride || getCurrentLegalVersions();
  const types: LegalDocumentType[] = ['terms', 'privacy', 'cannabis'];

  const blocking: LegalDocumentType[] = [];
  const notification: LegalDocumentType[] = [];

  for (const type of types) {
    const acceptance = state.acceptances[type];
    const currentVersion = currentVersions[type].version;

    if (!acceptance?.accepted || !acceptance.acceptedVersion) {
      blocking.push(type);
      continue;
    }

    if (isMajorVersionBump(acceptance.acceptedVersion, currentVersion)) {
      blocking.push(type);
    } else if (isMinorOrPatchBump(acceptance.acceptedVersion, currentVersion)) {
      notification.push(type);
    }
  }

  return {
    needsBlocking: blocking.length > 0,
    needsNotification: notification.length > 0,
    documents: blocking.length > 0 ? blocking : notification,
  };
}
