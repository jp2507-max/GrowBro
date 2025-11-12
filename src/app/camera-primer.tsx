import { useRouter } from 'expo-router';
import React, { useCallback } from 'react';

import { CameraPermissionPrimer } from '@/components/onboarding';
import { FocusAwareStatusBar } from '@/components/ui';
import { completeOnboardingStep } from '@/lib/compliance/onboarding-state';

/**
 * Camera/Photo permission primer screen
 * Part of the onboarding flow (step 5)
 *
 * Requirements:
 * - Privacy-First: explains PHPicker/camera usage (design 4)
 * - Educational Focus: shows photo features value
 * - Core app usable without permission (design 4)
 * - Offline-First: works offline, no network needed
 */
export default function CameraPrimerScreen(): React.ReactElement {
  const router = useRouter();

  const handleComplete = useCallback(
    (granted: boolean) => {
      // Mark this step as complete regardless of whether permission was granted
      // The app works fully without camera/photo permissions
      completeOnboardingStep('camera-primer');

      // Analytics: track permission decision
      console.log(
        `[CameraPrimer] Permission ${granted ? 'granted' : 'denied or skipped'}`
      );

      // Navigate to app - onboarding is complete
      router.replace('/(app)');
    },
    [router]
  );

  return (
    <>
      <FocusAwareStatusBar />
      <CameraPermissionPrimer
        onComplete={handleComplete}
        testID="camera-primer-screen"
      />
    </>
  );
}
