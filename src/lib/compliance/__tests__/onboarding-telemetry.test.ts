/**
 * Onboarding Telemetry Tests
 * Verifies consent-gated analytics tracking for onboarding flow
 */

import { InMemoryMetrics } from '@/lib/analytics';
import { setAnalyticsClient } from '@/lib/analytics-registry';
import { setPrivacyConsent } from '@/lib/privacy-consent';

import {
  trackActivationAction,
  trackOnboardingComplete,
  trackOnboardingSkipped,
  trackOnboardingStart,
  trackOnboardingStepComplete,
  trackPrimerAccepted,
  trackPrimerShown,
} from '../onboarding-telemetry';

describe('Onboarding Telemetry', () => {
  let metrics: InMemoryMetrics;

  beforeEach(() => {
    // Reset analytics consent
    setPrivacyConsent({
      analytics: false,
      crashReporting: false,
      personalizedData: false,
      sessionReplay: false,
    });

    // Create fresh metrics client
    metrics = new InMemoryMetrics();
    setAnalyticsClient(metrics);
  });

  afterEach(() => {
    metrics.clear();
  });

  describe('Consent Gating', () => {
    it('should not track events when analytics consent is false', () => {
      setPrivacyConsent({
        analytics: false,
        crashReporting: false,
        personalizedData: false,
        sessionReplay: false,
      });

      trackOnboardingStart('first_run');
      trackOnboardingComplete(5000, 3);
      trackPrimerShown('notifications');

      expect(metrics.getAll()).toHaveLength(0);
    });

    it('should track events when analytics consent is true', () => {
      setPrivacyConsent({
        analytics: true,
        crashReporting: false,
        personalizedData: false,
        sessionReplay: false,
      });

      trackOnboardingStart('first_run');

      const events = metrics.getAll();
      expect(events).toHaveLength(1);
      expect(events[0]?.name).toBe('onboarding_start');
    });
  });

  describe('trackOnboardingStart', () => {
    beforeEach(() => {
      setPrivacyConsent({
        analytics: true,
        crashReporting: false,
        personalizedData: false,
        sessionReplay: false,
      });
    });

    it('should track first_run source', () => {
      trackOnboardingStart('first_run');

      const events = metrics.getAll();
      expect(events).toHaveLength(1);
      expect(events[0]?.payload).toMatchObject({
        source: 'first_run',
        version: expect.any(Number),
      });
    });

    it('should track version_bump source', () => {
      trackOnboardingStart('version_bump');

      const events = metrics.getAll();
      expect(events[0]?.payload).toMatchObject({
        source: 'version_bump',
      });
    });

    it('should track manual source', () => {
      trackOnboardingStart('manual');

      const events = metrics.getAll();
      expect(events[0]?.payload).toMatchObject({
        source: 'manual',
      });
    });
  });

  describe('trackOnboardingComplete', () => {
    beforeEach(() => {
      setPrivacyConsent({
        analytics: true,
        crashReporting: false,
        personalizedData: false,
        sessionReplay: false,
      });
    });

    it('should track completion with duration', () => {
      trackOnboardingComplete(12000, 4);

      const events = metrics.getAll();
      expect(events).toHaveLength(1);
      expect(events[0]?.name).toBe('onboarding_complete');
      expect(events[0]?.payload).toMatchObject({
        duration_ms: 12000,
        steps_completed: 4,
        version: expect.any(Number),
      });
    });

    it('should track completion without duration', () => {
      trackOnboardingComplete(undefined, 3);

      const events = metrics.getAll();
      expect(events[0]?.payload).toMatchObject({
        duration_ms: undefined,
        steps_completed: 3,
      });
    });

    it('should use default steps_completed value', () => {
      trackOnboardingComplete(5000);

      const events = metrics.getAll();
      expect(events[0]?.payload).toMatchObject({
        steps_completed: 4,
      });
    });
  });

  describe('trackOnboardingSkipped', () => {
    beforeEach(() => {
      setPrivacyConsent({
        analytics: true,
        crashReporting: false,
        personalizedData: false,
        sessionReplay: false,
      });
    });

    it('should track skip with user_skip reason', () => {
      trackOnboardingSkipped('slide_2', 'user_skip');

      const events = metrics.getAll();
      expect(events).toHaveLength(1);
      expect(events[0]?.name).toBe('onboarding_skipped');
      expect(events[0]?.payload).toMatchObject({
        current_step: 'slide_2',
        reason: 'user_skip',
        version: expect.any(Number),
      });
    });

    it('should track skip with error reason', () => {
      trackOnboardingSkipped('consent', 'error');

      const events = metrics.getAll();
      expect(events[0]?.payload).toMatchObject({
        current_step: 'consent',
        reason: 'error',
      });
    });

    it('should track skip without reason', () => {
      trackOnboardingSkipped('primer');

      const events = metrics.getAll();
      expect(events[0]?.payload).toMatchObject({
        current_step: 'primer',
        reason: undefined,
      });
    });
  });

  describe('trackOnboardingStepComplete', () => {
    beforeEach(() => {
      setPrivacyConsent({
        analytics: true,
        crashReporting: false,
        personalizedData: false,
        sessionReplay: false,
      });
    });

    it('should track step completion with duration', () => {
      trackOnboardingStepComplete('slide_0', 3000);

      const events = metrics.getAll();
      expect(events).toHaveLength(1);
      expect(events[0]?.name).toBe('onboarding_step_complete');
      expect(events[0]?.payload).toMatchObject({
        step: 'slide_0',
        step_duration_ms: 3000,
        version: expect.any(Number),
      });
    });

    it('should track step completion without duration', () => {
      trackOnboardingStepComplete('age-gate');

      const events = metrics.getAll();
      expect(events[0]?.payload).toMatchObject({
        step: 'age-gate',
        step_duration_ms: undefined,
      });
    });
  });

  describe('trackPrimerShown', () => {
    beforeEach(() => {
      setPrivacyConsent({
        analytics: true,
        crashReporting: false,
        personalizedData: false,
        sessionReplay: false,
      });
    });

    it('should track notifications primer shown', () => {
      trackPrimerShown('notifications');

      const events = metrics.getAll();
      expect(events).toHaveLength(1);
      expect(events[0]?.name).toBe('primer_shown');
      expect(events[0]?.payload).toMatchObject({
        type: 'notifications',
      });
    });

    it('should track camera primer shown', () => {
      trackPrimerShown('camera');

      const events = metrics.getAll();
      expect(events[0]?.payload).toMatchObject({
        type: 'camera',
      });
    });

    it('should track photos primer shown', () => {
      trackPrimerShown('photos');

      const events = metrics.getAll();
      expect(events[0]?.payload).toMatchObject({
        type: 'photos',
      });
    });
  });

  describe('trackPrimerAccepted', () => {
    beforeEach(() => {
      setPrivacyConsent({
        analytics: true,
        crashReporting: false,
        personalizedData: false,
        sessionReplay: false,
      });
    });

    it('should track primer accepted with permission granted', () => {
      trackPrimerAccepted('notifications', true);

      const events = metrics.getAll();
      expect(events).toHaveLength(1);
      expect(events[0]?.name).toBe('primer_accepted');
      expect(events[0]?.payload).toMatchObject({
        type: 'notifications',
        permission_granted: true,
      });
    });

    it('should track primer accepted with permission denied', () => {
      trackPrimerAccepted('camera', false);

      const events = metrics.getAll();
      expect(events[0]?.payload).toMatchObject({
        type: 'camera',
        permission_granted: false,
      });
    });
  });

  describe('trackActivationAction', () => {
    beforeEach(() => {
      setPrivacyConsent({
        analytics: true,
        crashReporting: false,
        personalizedData: false,
        sessionReplay: false,
      });
    });

    it('should track create-task action', () => {
      trackActivationAction('create-task', true, 'home');

      const events = metrics.getAll();
      expect(events).toHaveLength(1);
      expect(events[0]?.name).toBe('activation_action');
      expect(events[0]?.payload).toMatchObject({
        action: 'create-task',
        completed: true,
        context: 'home',
      });
    });

    it('should track try-ai-diagnosis action', () => {
      trackActivationAction('try-ai-diagnosis', true);

      const events = metrics.getAll();
      expect(events[0]?.payload).toMatchObject({
        action: 'try-ai-diagnosis',
        completed: true,
        context: undefined,
      });
    });

    it('should track explore-strains action', () => {
      trackActivationAction('explore-strains', false, 'strains_list');

      const events = metrics.getAll();
      expect(events[0]?.payload).toMatchObject({
        action: 'explore-strains',
        completed: false,
        context: 'strains_list',
      });
    });
  });

  describe('Event Sequence', () => {
    beforeEach(() => {
      setPrivacyConsent({
        analytics: true,
        crashReporting: false,
        personalizedData: false,
        sessionReplay: false,
      });
    });

    it('should track complete onboarding flow', () => {
      // Start onboarding
      trackOnboardingStart('first_run');

      // Complete steps
      trackOnboardingStepComplete('age-gate', 2000);
      trackOnboardingStepComplete('legal', 3000);
      trackOnboardingStepComplete('consent', 1500);

      // Show and accept primers
      trackPrimerShown('notifications');
      trackPrimerAccepted('notifications', true);
      trackPrimerShown('camera');
      trackPrimerAccepted('camera', false);

      // Complete onboarding
      trackOnboardingComplete(15000, 6);

      const events = metrics.getAll();
      expect(events).toHaveLength(9);
      expect(events.map((e) => e.name)).toEqual([
        'onboarding_start',
        'onboarding_step_complete',
        'onboarding_step_complete',
        'onboarding_step_complete',
        'primer_shown',
        'primer_accepted',
        'primer_shown',
        'primer_accepted',
        'onboarding_complete',
      ]);
    });

    it('should track skipped onboarding flow', () => {
      trackOnboardingStart('first_run');
      trackOnboardingStepComplete('slide_0', 1000);
      trackOnboardingSkipped('slide_1', 'user_skip');

      const events = metrics.getAll();
      expect(events).toHaveLength(3);
      expect(events[2]?.name).toBe('onboarding_skipped');
    });
  });
});
