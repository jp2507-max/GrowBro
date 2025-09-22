// Mock expo-constants before importing anything that uses @env
import {
  createReviewerInstructions,
  generateDemoFlow,
  provideTestCredentials,
  validateAccessToGatedFeatures,
} from '@/lib/compliance/app-access-manager';

// Mock __DEV__ to be true for testing credential access
Object.defineProperty(global, '__DEV__', {
  value: true,
  writable: false,
});

jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      // In production builds, EXPO_PUBLIC_APP_ACCESS_REVIEWER_* won't be exposed
      // so we test the fallback to direct env vars
    },
  },
  manifest2: null,
}));

// Mock the env module that @env imports from
jest.mock('@/lib/env', () => ({
  Env: {
    APP_ACCESS_REVIEWER_EMAIL: 'reviewer@example.com',
    APP_ACCESS_REVIEWER_PASSWORD: 'Sup3rSecret!',
    EXPO_PUBLIC_APP_ACCESS_REVIEWER_EMAIL: undefined,
    EXPO_PUBLIC_APP_ACCESS_REVIEWER_PASSWORD: undefined,
  },
}));

describe('AppAccessManager - credentials', () => {
  test('provideTestCredentials masks secrets and stays valid in dev mode', () => {
    const credentials = provideTestCredentials();

    expect(credentials.valid).toBe(true);
    expect(credentials.username.envKey).toBe('APP_ACCESS_REVIEWER_EMAIL');
    expect(credentials.username.masked).toContain('@example.com');
    expect(credentials.password.masked).toContain(
      'env:APP_ACCESS_REVIEWER_PASSWORD'
    );
    expect(credentials.notes.length).toBeGreaterThan(0);
  });

  test('provideTestCredentials returns absent credentials in production mode', () => {
    // Temporarily override __DEV__ for this test
    const originalDev = global.__DEV__;
    Object.defineProperty(global, '__DEV__', {
      value: false,
      writable: true,
    });

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
    Object.defineProperty(global, '__DEV__', {
      value: originalDev,
      writable: false,
    });
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
    // Ensure __DEV__ is true for credential validation
    expect(global.__DEV__).toBe(true);
    const result = validateAccessToGatedFeatures();
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
  });
});
