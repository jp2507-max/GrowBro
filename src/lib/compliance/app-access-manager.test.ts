// Import after mocking

import {
  AppAccessManager,
  createReviewerInstructions,
  generateDemoFlow,
  provideTestCredentials,
  validateAccessToGatedFeatures,
} from '@/lib/compliance/app-access-manager';

// Mock @env module
jest.mock('@env', () => ({
  APP_ACCESS_REVIEWER_EMAIL: 'reviewer@example.com',
  APP_ACCESS_REVIEWER_PASSWORD: 'Sup3rSecret!',
}));

describe('AppAccessManager - credentials', () => {
  const mockedEnv = jest.mocked(jest.requireMock('@env'));

  beforeEach(() => {
    mockedEnv.APP_ACCESS_REVIEWER_EMAIL = 'reviewer@example.com';
    mockedEnv.APP_ACCESS_REVIEWER_PASSWORD = 'Sup3rSecret!';
  });

  afterEach(() => {
    // Reset to default mocked values
    mockedEnv.APP_ACCESS_REVIEWER_EMAIL = 'reviewer@example.com';
    mockedEnv.APP_ACCESS_REVIEWER_PASSWORD = 'Sup3rSecret!';
  });

  test('provideTestCredentials masks secrets and stays valid', () => {
    const credentials = provideTestCredentials();

    expect(credentials.valid).toBe(true);
    expect(credentials.username.envKey).toBe('APP_ACCESS_REVIEWER_EMAIL');
    expect(credentials.username.masked).toContain('@example.com');
    expect(credentials.password.masked).toContain(
      'env:APP_ACCESS_REVIEWER_PASSWORD'
    );
    expect(credentials.notes.length).toBeGreaterThan(0);
  });
});

describe('AppAccessManager - demo flow and instructions', () => {
  const mockedEnv = jest.mocked(jest.requireMock('@env'));

  beforeEach(() => {
    mockedEnv.APP_ACCESS_REVIEWER_EMAIL = 'reviewer@example.com';
    mockedEnv.APP_ACCESS_REVIEWER_PASSWORD = 'Sup3rSecret!';
  });

  afterEach(() => {
    // Reset to default mocked values
    mockedEnv.APP_ACCESS_REVIEWER_EMAIL = 'reviewer@example.com';
    mockedEnv.APP_ACCESS_REVIEWER_PASSWORD = 'Sup3rSecret!';
  });

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
  const mockedEnv = jest.mocked(jest.requireMock('@env'));

  beforeEach(() => {
    mockedEnv.APP_ACCESS_REVIEWER_EMAIL = 'reviewer@example.com';
    mockedEnv.APP_ACCESS_REVIEWER_PASSWORD = 'Sup3rSecret!';
  });

  afterEach(() => {
    // Reset to default mocked values
    mockedEnv.APP_ACCESS_REVIEWER_EMAIL = 'reviewer@example.com';
    mockedEnv.APP_ACCESS_REVIEWER_PASSWORD = 'Sup3rSecret!';
  });

  test('validateAccessToGatedFeatures passes when env and deep links are valid', () => {
    const result = validateAccessToGatedFeatures();
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  test('validateAccessToGatedFeatures fails when credentials missing', () => {
    mockedEnv.APP_ACCESS_REVIEWER_EMAIL = undefined;
    mockedEnv.APP_ACCESS_REVIEWER_PASSWORD = undefined;

    const result = AppAccessManager.validateAccessToGatedFeatures();

    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.feature === 'credentials')).toBe(
      true
    );
  });
});
