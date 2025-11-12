import { useRouter } from 'expo-router';
import React, { useCallback } from 'react';

import { NotificationPermissionPrimer } from '@/components/onboarding';
import { FocusAwareStatusBar } from '@/components/ui';
import { completeOnboardingStep } from '@/lib/compliance/onboarding-state';

/**
 * Notification permission primer screen
 * Part of the onboarding flow (step 4)
 *
 * Requirements:
 * - Privacy-First: explains benefit before requesting (req 4.3)
 * - Educational Focus: shows value proposition
 * - Core app usable without permission (design 4)
 * - Offline-First: works offline, no network needed
 */
export default function NotificationPrimerScreen(): React.ReactElement {
  const router = useRouter();

  const handleComplete = useCallback(
    (granted: boolean) => {
      // Mark this step as complete regardless of whether permission was granted
      // The app works fully without notifications
      completeOnboardingStep('notification-primer');

      // Analytics: track permission decision
      console.log(
        `[NotificationPrimer] Permission ${granted ? 'granted' : 'denied or skipped'}`
      );

      // Navigate to next step (camera primer) or complete onboarding
      router.replace('/(app)');
    },
    [router]
  );

  return (
    <>
      <FocusAwareStatusBar />
      <NotificationPermissionPrimer
        onComplete={handleComplete}
        testID="notification-primer-screen"
      />
    </>
  );
}
