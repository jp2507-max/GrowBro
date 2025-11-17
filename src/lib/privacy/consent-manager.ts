import { hasConsent, onPrivacyConsentChange } from '../privacy-consent';
import { ConsentService } from './consent-service';
import type { ConsentPurpose as RuntimeConsentPurpose } from './consent-types';

export type ConsentPurpose =
  | RuntimeConsentPurpose
  | 'analytics'
  | 'crashReporting';

export type ConsentChangeCallback = (
  consented: boolean,
  purpose: ConsentPurpose
) => void;

/**
 * ConsentManager abstraction for unified consent management across the app.
 *
 * Provides a clean interface for checking consent status, requesting consent,
 * revoking consent, and subscribing to consent changes. Implements default
 * opt-out behavior and ensures persistent storage of user choices.
 *
 * Integration points:
 * - App startup: Check hasConsented() before initializing analytics/diagnostics SDKs
 * - Background services: Subscribe to onConsentChanged() to enable/disable dispatching
 * - SDK wrappers: Queue events until consent granted, then flush on consent
 */
export interface ConsentManager {
  /**
   * Check if user has consented to a specific purpose
   * @param purpose The consent purpose to check
   * @returns true if user has consented, false otherwise (default opt-out)
   */
  hasConsented(purpose: ConsentPurpose): boolean;

  /**
   * Request consent for a specific purpose
   * This should trigger the consent UI flow
   * @param purpose The consent purpose to request
   * @returns Promise that resolves when consent request is complete
   */
  requestConsent(purpose: ConsentPurpose): Promise<boolean>;

  /**
   * Revoke consent for a specific purpose
   * @param purpose The consent purpose to revoke
   */
  revokeConsent(purpose: ConsentPurpose): Promise<void>;

  /**
   * Subscribe to consent changes for a specific purpose
   * @param purpose The consent purpose to monitor
   * @param callback Function called when consent status changes
   * @returns Unsubscribe function
   */
  onConsentChanged(
    purpose: ConsentPurpose,
    callback: ConsentChangeCallback
  ): () => void;
}

/**
 * Implementation of ConsentManager using existing consent services
 */
export class ConsentManagerImpl implements ConsentManager {
  private consentListeners = new Map<
    ConsentPurpose,
    Set<ConsentChangeCallback>
  >();

  constructor() {
    // Subscribe to consent changes from both services
    ConsentService.onChange((state) => {
      // Handle telemetry consent changes
      this.notifyListeners('telemetry', state.telemetry);

      // Handle other purposes that might be mapped from ConsentService
      // Note: ConsentService primarily handles telemetry, experiments, aiTraining, crashDiagnostics
      // while privacy-consent handles analytics, crashReporting, etc.
    });

    onPrivacyConsentChange((consent) => {
      // Handle privacy consent changes
      this.notifyListeners('analytics', consent.analytics);
      this.notifyListeners('crashReporting', consent.crashReporting);
    });
  }

  hasConsented(purpose: ConsentPurpose): boolean {
    switch (purpose) {
      case 'analytics':
        return hasConsent('analytics');
      case 'crashReporting':
        return hasConsent('crashReporting');
      case 'telemetry':
        return ConsentService.hasConsent('telemetry');
      default:
        return false; // Default opt-out for unknown purposes
    }
  }

  async requestConsent(purpose: ConsentPurpose): Promise<boolean> {
    // This method should trigger the consent UI flow
    // For now, we'll return the current consent status
    // In a real implementation, this would show a consent modal/prompt
    return this.hasConsented(purpose);
  }

  async revokeConsent(purpose: ConsentPurpose): Promise<void> {
    switch (purpose) {
      case 'analytics':
      case 'crashReporting':
        // These are handled by privacy-consent service
        // Note: We can't directly revoke from here as it requires UI interaction
        // The UI should call the appropriate service methods
        break;
      case 'telemetry':
        await ConsentService.setConsent('telemetry', false);
        break;
    }
  }

  onConsentChanged(
    purpose: ConsentPurpose,
    callback: ConsentChangeCallback
  ): () => void {
    if (!this.consentListeners.has(purpose)) {
      this.consentListeners.set(purpose, new Set());
    }

    const listeners = this.consentListeners.get(purpose)!;
    listeners.add(callback);

    // Return unsubscribe function
    return () => {
      listeners.delete(callback);
      if (listeners.size === 0) {
        this.consentListeners.delete(purpose);
      }
    };
  }

  private notifyListeners(purpose: ConsentPurpose, consented: boolean): void {
    const listeners = this.consentListeners.get(purpose);
    if (listeners) {
      for (const callback of listeners) {
        try {
          callback(consented, purpose);
        } catch (error) {
          console.warn(`Consent change callback failed for ${purpose}:`, error);
        }
      }
    }
  }
}

// Export singleton instance
export const consentManager = new ConsentManagerImpl();
