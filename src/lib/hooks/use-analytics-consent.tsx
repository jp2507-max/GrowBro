import { useEffect, useState } from 'react';

import { hasConsent, onPrivacyConsentChange } from '../privacy-consent';

/**
 * Hook that provides reactive analytics consent state
 * Returns the current analytics consent status and automatically updates when consent changes
 */
export function useAnalyticsConsent(): boolean {
  const [hasAnalyticsConsent, setHasAnalyticsConsent] = useState(() =>
    hasConsent('analytics')
  );

  useEffect(() => {
    const unsubscribe = onPrivacyConsentChange((updatedConsent) => {
      setHasAnalyticsConsent(updatedConsent.analytics);
    });

    return unsubscribe;
  }, []);

  return hasAnalyticsConsent;
}
