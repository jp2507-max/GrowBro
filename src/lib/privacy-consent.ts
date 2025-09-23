import * as Sentry from '@sentry/react-native';

import { getItem, setItem } from './storage';

export interface PrivacyConsent {
  analytics: boolean;
  crashReporting: boolean;
  personalizedData: boolean; // For sendDefaultPii
  sessionReplay: boolean;
  lastUpdated: number;
}

// Only consent feature keys (exclude metadata like lastUpdated)
export type ConsentFeature = Exclude<keyof PrivacyConsent, 'lastUpdated'>;

const DEFAULT_CONSENT: PrivacyConsent = {
  analytics: false,
  crashReporting: true,
  personalizedData: false,
  sessionReplay: false,
  lastUpdated: Date.now(),
};

// Cached consent state for synchronous access
let cachedConsent: PrivacyConsent | null = null;

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
  try {
    const stored = getItem<PrivacyConsent>('privacy-consent');
    if (stored) {
      const consent = { ...DEFAULT_CONSENT, ...stored };
      // Populate cache with the loaded consent
      cachedConsent = consent;
      return consent;
    }
  } catch (error) {
    console.warn('Failed to load privacy consent settings:', error);
  }
  // Populate cache with default consent
  cachedConsent = DEFAULT_CONSENT;
  return DEFAULT_CONSENT;
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

    setItem('privacy-consent', updated);

    // Update cache with the new consent
    cachedConsent = updated;

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
  const consent = getPrivacyConsent();
  updateSentryConsent(consent);
}

// Lightweight subscription so SDKGate can react immediately to UI-driven consent changes
type ConsentListener = (consent: PrivacyConsent) => void;
const consentListeners = new Set<ConsentListener>();

export function onPrivacyConsentChange(cb: ConsentListener): () => void {
  consentListeners.add(cb);
  return () => consentListeners.delete(cb);
}
