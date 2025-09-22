import fs from 'fs';
import path from 'path';

import {
  createReviewerInstructions,
  validateAccessToGatedFeatures,
} from '@/lib/compliance/app-access-manager';

const originalEmail = process.env.APP_ACCESS_REVIEWER_EMAIL;
const originalPassword = process.env.APP_ACCESS_REVIEWER_PASSWORD;

// Mock expo-constants to provide the normalized env vars
jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      APP_ACCESS_REVIEWER_EMAIL: 'reviewer@example.com',
      APP_ACCESS_REVIEWER_PASSWORD: 'Sup3rSecret!',
    },
  },
  manifest2: null,
}));

const artifactPath = path.resolve(
  __dirname,
  '../../..',
  'compliance',
  'app-access.json'
);

describe('AppAccess compliance gate', () => {
  beforeEach(() => {
    process.env.APP_ACCESS_REVIEWER_EMAIL = 'reviewer@example.com';
    process.env.APP_ACCESS_REVIEWER_PASSWORD = 'Sup3rSecret!';
  });

  afterEach(() => {
    if (originalEmail === undefined) {
      delete process.env.APP_ACCESS_REVIEWER_EMAIL;
    } else {
      process.env.APP_ACCESS_REVIEWER_EMAIL = originalEmail;
    }

    if (originalPassword === undefined) {
      delete process.env.APP_ACCESS_REVIEWER_PASSWORD;
    } else {
      process.env.APP_ACCESS_REVIEWER_PASSWORD = originalPassword;
    }
  });

  test('validation passes when reviewer package is complete', () => {
    const result = validateAccessToGatedFeatures();
    expect(result.ok).toBe(true);
  });

  test('artifact stays in sync with reviewer instructions', () => {
    const artifactRaw = fs.readFileSync(artifactPath, 'utf8');
    const artifact = JSON.parse(artifactRaw) as {
      credentials: { usernameEnv: string; passwordEnv: string };
      features: { id: string; deepLinks: string[]; steps: string[] }[];
    };

    expect(artifact.credentials.usernameEnv).toBe('APP_ACCESS_REVIEWER_EMAIL');
    expect(artifact.credentials.passwordEnv).toBe(
      'APP_ACCESS_REVIEWER_PASSWORD'
    );

    const guide = createReviewerInstructions();

    const requiredFeatures = new Set(['assessment', 'community', 'reminders']);
    const artifactFeatureIds = artifact.features.map((feature) => feature.id);
    expect(new Set(artifactFeatureIds)).toEqual(requiredFeatures);

    for (const feature of artifact.features) {
      for (const link of feature.deepLinks) {
        expect(guide.deepLinkEntryPoints).toContain(link);
      }

      if (feature.id === 'assessment') {
        for (const step of feature.steps) {
          expect(guide.stepsToReachAssessment).toContain(step);
        }
      }
      if (feature.id === 'community') {
        for (const step of feature.steps) {
          expect(guide.stepsToReachCommunity).toContain(step);
        }
      }
      if (feature.id === 'reminders') {
        for (const step of feature.steps) {
          expect(guide.stepsToReachReminders).toContain(step);
        }
      }
    }
  });
});
