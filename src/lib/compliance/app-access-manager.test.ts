// Mock expo-constants before importing anything that uses @env
import {
  createReviewerInstructions,
  generateDemoFlow,
  provideTestCredentials,
  validateAccessToGatedFeatures,
} from '@/lib/compliance/app-access-manager';

// __DEV__ is now initialized globally in jest-setup.ts

jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      // In production builds, EXPO_PUBLIC_APP_ACCESS_REVIEWER_* won't be exposed
      // so we test the fallback to direct env vars
    },
  },
  manifest2: null,
}));

// @env is now mocked globally in jest-setup.ts

describe('AppAccessManager - credentials', () => {
  test('provideTestCredentials masks secrets and stays valid in dev mode', () => {
    const credentials = provideTestCredentials();

    expect(credentials.valid).toBe(true);
    expect(credentials.username.envKey).toBe(
      'EXPO_PUBLIC_APP_ACCESS_REVIEWER_EMAIL'
    );
    expect(credentials.username.masked).toContain('@example.com');
    expect(credentials.password.masked).toContain(
      'env:EXPO_PUBLIC_APP_ACCESS_REVIEWER_PASSWORD'
    );
    expect(credentials.notes.length).toBeGreaterThan(0);
  });

  test('provideTestCredentials returns absent credentials in production mode', () => {
    // Temporarily override __DEV__ for this test to simulate production
    const originalDev = (globalThis as any).__DEV__;
    (globalThis as any).__DEV__ = false;

    const credentials = provideTestCredentials();

    expect(credentials.valid).toBe(false);
    expect(credentials.username.present).toBe(false);
    expect(credentials.username.masked).toBe('<unset>');
    expect(credentials.password.present).toBe(false);
    expect(credentials.password.masked).toBe('<unset>');
    expect(credentials.notes).toContain(
      'Credentials are managed securely in production builds.'
    );

    // Restore original __DEV__ value
    (globalThis as any).__DEV__ = originalDev;
  });
});

describe('AppAccessManager - demo flow and instructions', () => {
  test('generateDemoFlow exposes steps for every required feature', () => {
    const flow = generateDemoFlow();
    const features = new Set(flow.steps.map((step) => step.feature));

    expect(features.has('assessment')).toBe(true);
    expect(features.has('community')).toBe(true);
    expect(features.has('reminders')).toBe(true);
    expect(flow.prerequisites.length).toBeGreaterThan(0);
  });

  test('createReviewerInstructions aggregates deep links and checklists', () => {
    const guide = createReviewerInstructions();

    expect(guide.deepLinkEntryPoints).toEqual(
      expect.arrayContaining([
        'growbro://app-access/assessment-overview',
        'https://growbro.app/app-access/assessment-overview',
        'growbro://feed',
        'https://growbro.app/feed',
        'growbro://calendar',
        'https://growbro.app/calendar',
      ])
    );
    expect(guide.stepsToReachAssessment.length).toBeGreaterThan(0);
    expect(guide.stepsToReachCommunity.length).toBeGreaterThan(0);
    expect(guide.stepsToReachReminders.length).toBeGreaterThan(0);
  });
});

describe('AppAccessManager - validation', () => {
  test('validateAccessToGatedFeatures passes when env and deep links are valid in dev mode', () => {
    const result = validateAccessToGatedFeatures();
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
  });
});
