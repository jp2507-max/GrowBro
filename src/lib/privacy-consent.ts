import * as Sentry from '@sentry/react-native';

import {
  getSecureConfig,
  removeSecureConfig,
  setSecureConfig,
} from '@/lib/privacy/secure-config-store';

export interface PrivacyConsent {
  analytics: boolean;
  crashReporting: boolean;
  personalizedData: boolean; // For sendDefaultPii
  sessionReplay: boolean;
  lastUpdated: number;
}

// Only consent feature keys (exclude metadata like lastUpdated)
export type ConsentFeature = Exclude<keyof PrivacyConsent, 'lastUpdated'>;

const CONSENT_STORAGE_KEY = 'privacy-consent.v1';

const DEFAULT_CONSENT: PrivacyConsent = {
  analytics: false,
  crashReporting: true,
  personalizedData: false,
  sessionReplay: false,
  lastUpdated: Date.now(),
};

// Cached consent state for synchronous access
let cachedConsent: PrivacyConsent = { ...DEFAULT_CONSENT };
let hydrated = false;
let hydrationPromise: Promise<void> | null = null;

async function hydrateFromSecureStore(): Promise<void> {
  if (hydrationPromise) return hydrationPromise;
  hydrationPromise = (async () => {
    try {
      const stored = await getSecureConfig<PrivacyConsent>(CONSENT_STORAGE_KEY);
      if (stored) {
        cachedConsent = { ...DEFAULT_CONSENT, ...stored };
      }
    } catch (error) {
      console.warn(
        'Failed to hydrate privacy consent from secure storage:',
        error
      );
    } finally {
      hydrated = true;
      hydrationPromise = null;
    }
  })();
  return hydrationPromise;
}

void hydrateFromSecureStore();

/**
 * Get current privacy consent settings synchronously from cache
 * Returns null if cache hasn't been populated yet
 */
export function getPrivacyConsentSync(): PrivacyConsent | null {
  return cachedConsent;
}

/**
 * Get current privacy consent settings
 */
export function getPrivacyConsent(): PrivacyConsent {
  if (!hydrated && !hydrationPromise) {
    void hydrateFromSecureStore();
  }
  return cachedConsent;
}

/**
 * Update privacy consent settings
 */
export function setPrivacyConsent(consent: Partial<PrivacyConsent>): void {
  try {
    const current = getPrivacyConsent();
    const updated: PrivacyConsent = {
      ...current,
      ...consent,
      lastUpdated: Date.now(),
    };

    // Update cache with the new consent
    cachedConsent = updated;

    void setSecureConfig(CONSENT_STORAGE_KEY, updated).catch((error) => {
      console.error('Failed to store privacy consent securely:', error);
    });

    // Update Sentry configuration based on consent
    updateSentryConsent(updated);

    // Notify listeners
    for (const cb of consentListeners) {
      try {
        cb(updated);
      } catch {}
    }
  } catch (error) {
    console.error('Failed to save privacy consent settings:', error);
  }
}

/**
 * Update Sentry configuration based on user consent
 */
function updateSentryConsent(consent: PrivacyConsent): void {
  try {
    // Update Sentry user context to reflect consent
    Sentry.setContext('privacy_consent', {
      analytics: consent.analytics,
      crashReporting: consent.crashReporting,
      personalizedData: consent.personalizedData,
      sessionReplay: consent.sessionReplay,
      lastUpdated: new Date(consent.lastUpdated).toISOString(),
    });

    // Note: Some Sentry settings like sendDefaultPii and replay sampling
    // are set at initialization and cannot be changed at runtime.
    // For dynamic consent management, you would need to reinitialize Sentry
    // or implement custom filtering in the beforeSend hook.
  } catch (error) {
    console.warn('Failed to update Sentry consent settings:', error);
  }
}

/**
 * Check if user has given consent for a specific privacy feature
 */
export function hasConsent(feature: ConsentFeature): boolean {
  const consent = getPrivacyConsent();
  return consent[feature] === true;
}

/**
 * Initialize privacy consent on app start
 * This ensures the cache is populated for synchronous access
 */
export function initializePrivacyConsent(): void {
  void hydrateFromSecureStore().finally(() => {
    updateSentryConsent(getPrivacyConsent());
  });
}

// Lightweight subscription so SDKGate can react immediately to UI-driven consent changes
type ConsentListener = (consent: PrivacyConsent) => void;
const consentListeners = new Set<ConsentListener>();

export function onPrivacyConsentChange(cb: ConsentListener): () => void {
  consentListeners.add(cb);
  return () => consentListeners.delete(cb);
}

/** @internal test helper */
export async function __resetPrivacyConsentForTests(): Promise<void> {
  cachedConsent = { ...DEFAULT_CONSENT, lastUpdated: Date.now() };
  hydrated = false;
  hydrationPromise = null;
  consentListeners.clear();
  await removeSecureConfig(CONSENT_STORAGE_KEY);
}
