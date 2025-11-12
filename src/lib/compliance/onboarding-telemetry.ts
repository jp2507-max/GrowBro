/**
 * Onboarding & Activation Telemetry
 * Privacy-first analytics for onboarding flow (guarded by consent)
 */

import { getAnalyticsClient } from '@/lib/analytics-registry';
import { ONBOARDING_VERSION } from '@/lib/compliance/onboarding-state';

/**
 * Get the current analytics client from the registry.
 * The registry automatically handles consent gating and SDK initialization.
 */
function getClient() {
  return getAnalyticsClient();
}

export function trackOnboardingStart(
  source: 'first_run' | 'version_bump' | 'manual'
): void {
  getClient().track('onboarding_start', {
    version: ONBOARDING_VERSION,
    source,
  });
}

export function trackOnboardingComplete(
  durationMs?: number,
  stepsCompleted: number = 4
): void {
  getClient().track('onboarding_complete', {
    version: ONBOARDING_VERSION,
    duration_ms: durationMs,
    steps_completed: stepsCompleted,
  });
}

export function trackOnboardingSkipped(
  currentStep: string,
  reason?: 'user_skip' | 'error' | 'navigation'
): void {
  getClient().track('onboarding_skipped', {
    version: ONBOARDING_VERSION,
    current_step: currentStep,
    reason,
  });
}

export function trackOnboardingStepComplete(
  step: string,
  stepDurationMs?: number
): void {
  getClient().track('onboarding_step_complete', {
    version: ONBOARDING_VERSION,
    step,
    step_duration_ms: stepDurationMs,
  });
}

export function trackPrimerShown(
  type: 'notifications' | 'photos' | 'camera'
): void {
  getClient().track('primer_shown', { type });
}

export function trackPrimerAccepted(
  type: 'notifications' | 'photos' | 'camera',
  permissionGranted: boolean
): void {
  getClient().track('primer_accepted', {
    type,
    permission_granted: permissionGranted,
  });
}

export function trackActivationAction(
  action:
    | 'create_task'
    | 'adopt_playbook'
    | 'view_strain'
    | 'bookmark_strain'
    | 'capture_photo',
  completed: boolean,
  context?: string
): void {
  getClient().track('activation_action', {
    action,
    completed,
    context,
  });
}
