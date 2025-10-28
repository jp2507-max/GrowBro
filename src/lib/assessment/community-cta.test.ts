import type { AssessmentResult } from '@/types/assessment';

import {
  getCommunityCTAMessage,
  getCommunityCTAUrgency,
  shouldShowCommunityCTA,
} from './community-cta';

// Helper to create mock assessment result
const createMockAssessment = (
  calibratedConfidence: number,
  isOod: boolean = false
): AssessmentResult => ({
  topClass: {
    id: 'test-class',
    name: 'Test Class',
    category: 'nutrient',
    description: 'Test description',
    visualCues: [],
    isOod,
    actionTemplate: {
      immediateSteps: [],
      shortTermActions: [],
      diagnosticChecks: [],
      warnings: [],
      disclaimers: [],
    },
    createdAt: Date.now(),
  },
  rawConfidence: calibratedConfidence,
  calibratedConfidence,
  perImage: [],
  aggregationMethod: 'majority-vote',
  processingTimeMs: 100,
  mode: 'device',
  modelVersion: 'v1.0.0',
});

describe('shouldShowCommunityCTA', () => {
  test('returns true when calibrated confidence is below 70%', () => {
    const assessment = createMockAssessment(0.65);
    expect(shouldShowCommunityCTA(assessment)).toBe(true);
  });

  test('returns true when calibrated confidence is exactly at 69%', () => {
    const assessment = createMockAssessment(0.69);
    expect(shouldShowCommunityCTA(assessment)).toBe(true);
  });

  test('returns false when calibrated confidence is at 70%', () => {
    const assessment = createMockAssessment(0.7);
    expect(shouldShowCommunityCTA(assessment)).toBe(false);
  });

  test('returns false when calibrated confidence is above 70%', () => {
    const assessment = createMockAssessment(0.85);
    expect(shouldShowCommunityCTA(assessment)).toBe(false);
  });

  test('returns true when class is marked as OOD regardless of confidence', () => {
    const assessment = createMockAssessment(0.95, true);
    expect(shouldShowCommunityCTA(assessment)).toBe(true);
  });

  test('returns true when both confidence is low and class is OOD', () => {
    const assessment = createMockAssessment(0.5, true);
    expect(shouldShowCommunityCTA(assessment)).toBe(true);
  });

  test('returns false for high confidence non-OOD assessment', () => {
    const assessment = createMockAssessment(0.92, false);
    expect(shouldShowCommunityCTA(assessment)).toBe(false);
  });
});

describe('getCommunityCTAMessage', () => {
  test('returns "getSecondOpinion" for low confidence', () => {
    const assessment = createMockAssessment(0.65);
    expect(getCommunityCTAMessage(assessment)).toBe('getSecondOpinion');
  });

  test('returns "askCommunity" for OOD class with high confidence', () => {
    const assessment = createMockAssessment(0.85, true);
    expect(getCommunityCTAMessage(assessment)).toBe('askCommunity');
  });

  test('returns "getSecondOpinion" for low confidence OOD class', () => {
    const assessment = createMockAssessment(0.5, true);
    expect(getCommunityCTAMessage(assessment)).toBe('getSecondOpinion');
  });
});

describe('getCommunityCTAUrgency', () => {
  test('returns "high" for very low confidence (<50%)', () => {
    const assessment = createMockAssessment(0.45);
    expect(getCommunityCTAUrgency(assessment)).toBe('high');
  });

  test('returns "medium" for moderate low confidence (50-70%)', () => {
    const assessment = createMockAssessment(0.65);
    expect(getCommunityCTAUrgency(assessment)).toBe('medium');
  });

  test('returns "high" for OOD class regardless of confidence', () => {
    const assessment = createMockAssessment(0.85, true);
    expect(getCommunityCTAUrgency(assessment)).toBe('high');
  });

  test('returns "high" for very low confidence OOD class', () => {
    const assessment = createMockAssessment(0.3, true);
    expect(getCommunityCTAUrgency(assessment)).toBe('high');
  });
});
