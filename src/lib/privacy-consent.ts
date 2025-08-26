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
  crashReporting: true, // Basic crash reporting is usually acceptable
  personalizedData: false,
  sessionReplay: false,
  lastUpdated: Date.now(),
};

/**
 * Get current privacy consent settings
 */
export function getPrivacyConsent(): PrivacyConsent {
  try {
    const stored = getItem<PrivacyConsent>('privacy-consent');
    if (stored) {
      return { ...DEFAULT_CONSENT, ...stored };
    }
  } catch (error) {
    console.warn('Failed to load privacy consent settings:', error);
  }
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

    // Update Sentry configuration based on consent
    updateSentryConsent(updated);
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
 */
export function initializePrivacyConsent(): void {
  const consent = getPrivacyConsent();
  updateSentryConsent(consent);
}
