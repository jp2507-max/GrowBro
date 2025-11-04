/**
 * Hook to fetch privacy settings summary
 * Requirements: 2.5, 5.2
 */

import { useEffect, useState } from 'react';

import {
  getPrivacyConsent,
  hydrateFromSecureStore,
  onPrivacyConsentChange,
} from '@/lib/privacy-consent';

interface PrivacySummary {
  status: 'all_on' | 'all_off' | 'partial';
  isLoading: boolean;
}

export function usePrivacySummary(): PrivacySummary {
  const [summary, setSummary] = useState<PrivacySummary>({
    status: 'all_off',
    isLoading: true,
  });

  useEffect(() => {
    async function initializeAndSubscribe() {
      try {
        // Ensure hydration is complete before proceeding
        await hydrateFromSecureStore();

        // Set initial summary after hydration
        updateSummaryFromConsent();

        // Subscribe to consent changes
        const unsubscribe = onPrivacyConsentChange(() => {
          updateSummaryFromConsent();
        });

        return unsubscribe;
      } catch (error) {
        console.error('Failed to initialize privacy settings:', error);
        setSummary({ status: 'all_off', isLoading: false });
      }
    }

    function updateSummaryFromConsent() {
      try {
        const settings = getPrivacyConsent();

        const allOn =
          settings.crashReporting &&
          settings.analytics &&
          settings.personalizedData &&
          settings.sessionReplay;

        const allOff =
          !settings.crashReporting &&
          !settings.analytics &&
          !settings.personalizedData &&
          !settings.sessionReplay;

        if (allOn) {
          setSummary({ status: 'all_on', isLoading: false });
        } else if (allOff) {
          setSummary({ status: 'all_off', isLoading: false });
        } else {
          setSummary({ status: 'partial', isLoading: false });
        }
      } catch (error) {
        console.error('Failed to update privacy summary:', error);
        setSummary({ status: 'all_off', isLoading: false });
      }
    }

    let unsubscribe: (() => void) | undefined;
    const initPromise = initializeAndSubscribe().then((u) => {
      if (typeof u === 'function') unsubscribe = u;
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      } else {
        initPromise.then(() => {
          if (unsubscribe) unsubscribe();
        });
      }
    };
  }, []);

  return summary;
}
