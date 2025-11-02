/**
 * Hook to fetch security settings summary
 * Requirements: 2.5, 11.1
 */

import { useEffect, useState } from 'react';

import { storage } from '@/lib/storage';
import type { SecuritySettings } from '@/types/settings';

interface SecuritySummary {
  biometricEnabled: boolean;
  lastPasswordChange?: string;
  isLoading: boolean;
}

export function useSecuritySummary(userId: string): SecuritySummary {
  const [summary, setSummary] = useState<SecuritySummary>({
    biometricEnabled: false,
    isLoading: true,
  });

  useEffect(() => {
    async function fetchSecuritySettings() {
      try {
        const key = `security.settings.${userId}`;
        const settingsJson = storage.getString(key);

        if (!settingsJson) {
          setSummary({ biometricEnabled: false, isLoading: false });
          return;
        }

        const settings = JSON.parse(settingsJson) as SecuritySettings;

        setSummary({
          biometricEnabled: settings.biometricEnabled,
          lastPasswordChange: settings.lastPasswordChange,
          isLoading: false,
        });
      } catch (error) {
        console.error('Failed to fetch security settings:', error);
        setSummary({ biometricEnabled: false, isLoading: false });
      }
    }

    void fetchSecuritySettings();
  }, [userId]);

  return summary;
}
