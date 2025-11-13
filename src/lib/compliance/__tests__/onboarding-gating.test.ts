/**
 * Onboarding Gating & Version Bump Tests
 * Tests the entry conditions and routing logic for onboarding flow
 */

import { storage } from '@/lib/storage';

import {
  getOnboardingStatus,
  getOnboardingVersion,
  hydrateOnboardingState,
  loadPersistedState,
  markOnboardingAsCompleted,
  ONBOARDING_VERSION,
  type OnboardingStatus,
  resetOnboardingState,
  shouldShowOnboarding,
} from '../onboarding-state';

describe('Onboarding Gating & Version Bump', () => {
  beforeEach(() => {
    // Clean up storage before each test
    storage.delete('compliance.onboarding.state');
  });

  afterEach(() => {
    // Reset after each test
    resetOnboardingState();
  });

  describe('First Run Detection', () => {
    it('should detect first run when no state exists', () => {
      hydrateOnboardingState();
      const needsOnboarding = shouldShowOnboarding();
      const status = getOnboardingStatus();

      expect(needsOnboarding).toBe(true);
      expect(status).toBe('not-started');
    });

    it('should not show onboarding after completion', () => {
      markOnboardingAsCompleted();
      const needsOnboarding = shouldShowOnboarding();
      const status = getOnboardingStatus();

      expect(needsOnboarding).toBe(false);
      expect(status).toBe('completed');
    });

    it('should persist completion state', () => {
      markOnboardingAsCompleted();

      // Simulate app restart by hydrating again
      hydrateOnboardingState();

      const needsOnboarding = shouldShowOnboarding();
      const status = getOnboardingStatus();
      const version = getOnboardingVersion();

      expect(needsOnboarding).toBe(false);
      expect(status).toBe('completed');
      expect(version).toBe(ONBOARDING_VERSION);
    });
  });

  describe('Version Bump Re-show Logic', () => {
    it('should re-show onboarding after version bump', () => {
      // Complete onboarding with an old version
      const oldVersion = ONBOARDING_VERSION - 1;

      // Manually set old version in storage
      const state = {
        currentStep: 'completed' as const,
        completedSteps: [
          'age-gate',
          'legal-confirmation',
          'consent-modal',
          'completed',
        ] as const,
        lastUpdated: new Date().toISOString(),
        version: oldVersion,
        completedAt: new Date().toISOString(),
        status: 'completed' as OnboardingStatus,
      };
      storage.set('compliance.onboarding.state', JSON.stringify(state));

      // Hydrate and check
      hydrateOnboardingState();
      const needsOnboarding = shouldShowOnboarding();
      const currentVersion = getOnboardingVersion();

      expect(needsOnboarding).toBe(true);
      expect(currentVersion).toBe(oldVersion); // Still old version until completion
    });

    it('should not re-show if version matches', () => {
      // Complete with current version
      markOnboardingAsCompleted();

      hydrateOnboardingState();
      const needsOnboarding = shouldShowOnboarding();
      const version = getOnboardingVersion();

      expect(needsOnboarding).toBe(false);
      expect(version).toBe(ONBOARDING_VERSION);
    });

    it('should update version upon completion', () => {
      // Start with old version
      const oldVersion = ONBOARDING_VERSION - 1;
      const state = {
        currentStep: 'age-gate' as const,
        completedSteps: [] as const,
        lastUpdated: new Date().toISOString(),
        version: oldVersion,
        status: 'in-progress' as OnboardingStatus,
      };
      storage.set('compliance.onboarding.state', JSON.stringify(state));

      hydrateOnboardingState();
      expect(getOnboardingVersion()).toBe(oldVersion);

      // Complete onboarding
      markOnboardingAsCompleted();

      // Version should be updated
      expect(getOnboardingVersion()).toBe(ONBOARDING_VERSION);
    });
  });

  describe('Completion Tracking', () => {
    it('should track completion timestamp', () => {
      const beforeCompletion = Date.now();
      markOnboardingAsCompleted();
      const afterCompletion = Date.now();

      const persisted = loadPersistedState();

      expect(persisted.completedAt).toBeDefined();
      if (persisted.completedAt) {
        const completedTime = new Date(persisted.completedAt).getTime();
        expect(completedTime).toBeGreaterThanOrEqual(beforeCompletion);
        expect(completedTime).toBeLessThanOrEqual(afterCompletion);
      }
    });

    it('should set status to completed', () => {
      expect(getOnboardingStatus()).toBe('not-started');

      markOnboardingAsCompleted();

      expect(getOnboardingStatus()).toBe('completed');
    });

    it('should mark all steps as completed', () => {
      markOnboardingAsCompleted();
      const persisted = loadPersistedState();

      expect(persisted.currentStep).toBe('completed');
      expect(persisted.completedSteps).toContain('completed');
    });
  });

  describe('State Persistence', () => {
    it('should persist and restore state correctly', () => {
      markOnboardingAsCompleted();

      const persisted = loadPersistedState();

      expect(persisted.status).toBe('completed');
      expect(persisted.version).toBe(ONBOARDING_VERSION);
      expect(persisted.completedAt).toBeDefined();
      expect(persisted.currentStep).toBe('completed');
    });

    it('should handle missing version gracefully', () => {
      const stateWithoutVersion = {
        currentStep: 'completed' as const,
        completedSteps: [
          'age-gate',
          'legal-confirmation',
          'consent-modal',
          'completed',
        ] as const,
        lastUpdated: new Date().toISOString(),
        status: 'completed' as OnboardingStatus,
        completedAt: new Date().toISOString(),
      };
      storage.set(
        'compliance.onboarding.state',
        JSON.stringify(stateWithoutVersion)
      );

      const persisted = loadPersistedState();

      expect(persisted.version).toBeUndefined();
      expect(persisted.status).toBe('completed');
    });

    it('should handle corrupted state gracefully', () => {
      storage.set('compliance.onboarding.state', 'invalid json');

      const persisted = loadPersistedState();

      expect(persisted.status).toBe('not-started');
      expect(persisted.currentStep).toBe('age-gate');
      expect(persisted.completedSteps).toEqual([]);
    });
  });

  describe('Reset Functionality', () => {
    it('should reset state to initial', () => {
      markOnboardingAsCompleted();
      expect(getOnboardingStatus()).toBe('completed');

      resetOnboardingState();

      expect(getOnboardingStatus()).toBe('not-started');
      expect(shouldShowOnboarding()).toBe(true);
    });

    it('should clear persisted state', () => {
      markOnboardingAsCompleted();
      resetOnboardingState();

      const rawState = storage.getString('compliance.onboarding.state');
      // MMKV returns null (not undefined) for deleted/non-existent keys
      expect(rawState).toBeNull();
    });
  });

  describe('Manual Rewatch', () => {
    it('should allow manual rewatch after completion', () => {
      markOnboardingAsCompleted();
      expect(shouldShowOnboarding()).toBe(false);

      // Simulate settings menu rewatch
      resetOnboardingState();

      expect(shouldShowOnboarding()).toBe(true);
      expect(getOnboardingStatus()).toBe('not-started');
    });

    it('should not affect version after manual rewatch', () => {
      markOnboardingAsCompleted();

      resetOnboardingState();

      // After reset, version should be 0 (initial state)
      expect(getOnboardingVersion()).toBe(0);

      // Complete again
      markOnboardingAsCompleted();

      // Should be current version
      expect(getOnboardingVersion()).toBe(ONBOARDING_VERSION);
    });
  });

  describe('Edge Cases', () => {
    it('should handle in-progress state correctly', () => {
      const inProgressState = {
        currentStep: 'legal-confirmation' as const,
        completedSteps: ['age-gate'] as const,
        lastUpdated: new Date().toISOString(),
        version: ONBOARDING_VERSION,
        status: 'in-progress' as OnboardingStatus,
      };
      storage.set(
        'compliance.onboarding.state',
        JSON.stringify(inProgressState)
      );

      hydrateOnboardingState();

      // In-progress state should continue showing onboarding
      expect(shouldShowOnboarding()).toBe(true);
      expect(getOnboardingStatus()).toBe('in-progress');
    });

    it('should handle future version gracefully', () => {
      const futureVersion = ONBOARDING_VERSION + 100;
      const futureState = {
        currentStep: 'completed' as const,
        completedSteps: [
          'age-gate',
          'legal-confirmation',
          'consent-modal',
          'completed',
        ] as const,
        lastUpdated: new Date().toISOString(),
        version: futureVersion,
        completedAt: new Date().toISOString(),
        status: 'completed' as OnboardingStatus,
      };
      storage.set('compliance.onboarding.state', JSON.stringify(futureState));

      hydrateOnboardingState();

      // Future version means user has seen a newer onboarding
      expect(shouldShowOnboarding()).toBe(false);
      expect(getOnboardingVersion()).toBe(futureVersion);
    });

    it('should handle zero version as old version', () => {
      const zeroVersionState = {
        currentStep: 'completed' as const,
        completedSteps: [
          'age-gate',
          'legal-confirmation',
          'consent-modal',
          'completed',
        ] as const,
        lastUpdated: new Date().toISOString(),
        version: 0,
        completedAt: new Date().toISOString(),
        status: 'completed' as OnboardingStatus,
      };
      storage.set(
        'compliance.onboarding.state',
        JSON.stringify(zeroVersionState)
      );

      hydrateOnboardingState();

      // Version 0 means no version was recorded (old format),
      // but if status is completed with version 0, it means user completed onboarding
      // before version tracking was added. Since current version > 0, should re-show
      const currentVersion = ONBOARDING_VERSION;
      const shouldReshow = currentVersion > 0; // 0 < current version means re-show

      expect(shouldShowOnboarding()).toBe(shouldReshow);
      expect(getOnboardingVersion()).toBe(0);
    });
  });
});
