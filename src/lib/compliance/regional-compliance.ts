import * as Localization from 'expo-localization';
import { create, type StoreApi } from 'zustand';

import { getItem, setItem } from '@/lib/storage';
import { createSelectors } from '@/lib/utils';

const REGIONAL_COMPLIANCE_KEY = 'compliance.regional.mode';

// EU member states (as of 2025) for GDPR-compliant defaults
const EU_COUNTRIES = [
  'AT', // Austria
  'BE', // Belgium
  'BG', // Bulgaria
  'HR', // Croatia
  'CY', // Cyprus
  'CZ', // Czech Republic
  'DK', // Denmark
  'EE', // Estonia
  'FI', // Finland
  'FR', // France
  'DE', // Germany
  'GR', // Greece
  'HU', // Hungary
  'IE', // Ireland
  'IT', // Italy
  'LV', // Latvia
  'LT', // Lithuania
  'LU', // Luxembourg
  'MT', // Malta
  'NL', // Netherlands
  'PL', // Poland
  'PT', // Portugal
  'RO', // Romania
  'SK', // Slovakia
  'SI', // Slovenia
  'ES', // Spain
  'SE', // Sweden
];

// Restricted regions where conservative mode is enforced
const RESTRICTED_REGIONS = [
  'US', // United States - varies by state
  'CN', // China
  'RU', // Russia
  'SA', // Saudi Arabia
  'AE', // United Arab Emirates
  'SG', // Singapore
  'MY', // Malaysia
  'ID', // Indonesia
  'TH', // Thailand
  'PH', // Philippines
];

export type ComplianceMode = 'standard' | 'conservative';

export type RegionalComplianceState = {
  mode: ComplianceMode;
  detectedRegion: string | null;
  isRestricted: boolean;
  initialize: () => void;
  setMode: (mode: ComplianceMode) => void;
};

function detectRegion(): string | null {
  try {
    const locales = Localization.getLocales();
    if (locales && locales.length > 0) {
      return locales[0]?.regionCode ?? null;
    }
    return null;
  } catch {
    return null;
  }
}

function isRestrictedRegion(regionCode: string | null): boolean {
  if (!regionCode) return false;
  return RESTRICTED_REGIONS.includes(regionCode.toUpperCase());
}

function loadPersistedMode(): ComplianceMode | null {
  return getItem<ComplianceMode>(REGIONAL_COMPLIANCE_KEY);
}

function savePersistedMode(mode: ComplianceMode): void {
  setItem(REGIONAL_COMPLIANCE_KEY, mode);
}

function createInitializeFunction(
  set: StoreApi<RegionalComplianceState>['setState']
): () => void {
  return () => {
    const detectedRegion = detectRegion();
    const isRestricted = isRestrictedRegion(detectedRegion);
    const persistedMode = loadPersistedMode();

    // If in restricted region, always use conservative mode
    const mode: ComplianceMode =
      isRestricted || persistedMode === 'conservative'
        ? 'conservative'
        : 'standard';

    set({
      mode,
      detectedRegion,
      isRestricted,
    });

    savePersistedMode(mode);
  };
}

function createSetModeFunction(
  set: StoreApi<RegionalComplianceState>['setState']
): (mode: ComplianceMode) => void {
  return (mode: ComplianceMode) => {
    set({ mode });
    savePersistedMode(mode);
  };
}

function createRegionalComplianceStore(
  set: StoreApi<RegionalComplianceState>['setState'],
  _get: StoreApi<RegionalComplianceState>['getState']
): RegionalComplianceState {
  return {
    mode: 'standard' as ComplianceMode,
    detectedRegion: null,
    isRestricted: false,
    initialize: createInitializeFunction(set),
    setMode: createSetModeFunction(set),
  };
}

const _useRegionalCompliance = create<RegionalComplianceState>((set, get) =>
  createRegionalComplianceStore(set, get)
);

const regionalComplianceStore = createSelectors(_useRegionalCompliance);

export const useRegionalCompliance = regionalComplianceStore;

export function initializeRegionalCompliance(): void {
  regionalComplianceStore.getState().initialize();
}

export function setComplianceMode(mode: ComplianceMode): void {
  regionalComplianceStore.getState().setMode(mode);
}

export function getComplianceMode(): ComplianceMode {
  return regionalComplianceStore.getState().mode;
}

export function isConservativeMode(): boolean {
  return regionalComplianceStore.getState().mode === 'conservative';
}

export function getDetectedRegion(): string | null {
  return regionalComplianceStore.getState().detectedRegion;
}

export function isInRestrictedRegion(): boolean {
  return regionalComplianceStore.getState().isRestricted;
}

/**
 * Checks if the detected region is in the EU
 * Used for GDPR-compliant default settings
 */
export function isEURegion(regionCode?: string | null): boolean {
  const region = regionCode ?? getDetectedRegion();
  if (!region) return false;
  return EU_COUNTRIES.includes(region.toUpperCase());
}
