/**
 * Hook to fetch privacy settings summary
 * Requirements: 2.5, 5.2
 */

import { useEffect, useState } from 'react';

import { getPrivacyConsent } from '@/lib/privacy-consent';

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
    async function fetchSettings() {
      try {
        const settings = await getPrivacyConsent();

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
        console.error('Failed to fetch privacy settings:', error);
        setSummary({ status: 'all_off', isLoading: false });
      }
    }

    void fetchSettings();
  }, []);

  return summary;
}
