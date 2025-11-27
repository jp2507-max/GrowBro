import { useRouter } from 'expo-router';
import React, { useCallback } from 'react';

import { CameraPermissionPrimer } from '@/components/onboarding';
import { FocusAwareStatusBar } from '@/components/ui';
import { completeOnboardingStep } from '@/lib/compliance/onboarding-state';
import { useIsFirstTime } from '@/lib/hooks';

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
  const [, setIsFirstTime] = useIsFirstTime();

  const handleComplete = useCallback(
    (_granted: boolean) => {
      // Mark this step as complete regardless of whether permission was granted
      // The app works fully without camera/photo permissions
      completeOnboardingStep('camera-primer');

      // Note: Do not complete 'consent-modal' here as it would bypass the consent modal
      // and corrupt the onboarding state. The consent modal handles its own completion
      // in _layout.tsx when the user actually interacts with it.

      // Clear the first-time flag to prevent redirect loops
      setIsFirstTime(false);

      // Navigate to app - tab layout will redirect to login if not authenticated
      router.replace('/(app)');
    },
    [router, setIsFirstTime]
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
