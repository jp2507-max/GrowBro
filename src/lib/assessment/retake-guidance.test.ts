import type { QualityResult } from '@/types/assessment';

import {
  generateRetakeGuidance,
  getIssueDescription,
  shouldRecommendRetake,
} from './retake-guidance';

// Helper to create mock quality result
const createQualityResult = (
  acceptable: boolean,
  issues: {
    type: string;
    severity: 'high' | 'medium' | 'low';
  }[] = []
): QualityResult => ({
  score: acceptable ? 85 : 45,
  acceptable,
  issues: issues.map((issue) => ({
    type: issue.type as any,
    severity: issue.severity,
    suggestion: `Fix ${issue.type}`,
  })),
});

describe('generateRetakeGuidance', () => {
  test('identifies blur as primary issue', () => {
    const qualityScores = [
      createQualityResult(false, [{ type: 'blur', severity: 'high' }]),
    ];

    const guidance = generateRetakeGuidance(qualityScores);

    expect(guidance.primaryIssue).toBe('blur');
    expect(guidance.severity).toBe('high');
    expect(guidance.tips).toContain('Hold your phone steady or use a tripod');
  });

  test('identifies exposure as primary issue', () => {
    const qualityScores = [
      createQualityResult(false, [{ type: 'exposure', severity: 'high' }]),
    ];

    const guidance = generateRetakeGuidance(qualityScores);

    expect(guidance.primaryIssue).toBe('exposure');
    expect(guidance.tips).toContain(
      'Adjust lighting to avoid over/under-exposure'
    );
  });

  test('identifies white balance as primary issue', () => {
    const qualityScores = [
      createQualityResult(false, [
        { type: 'white_balance', severity: 'medium' },
      ]),
    ];

    const guidance = generateRetakeGuidance(qualityScores);

    expect(guidance.primaryIssue).toBe('white_balance');
    expect(guidance.tips).toContain(
      'Use neutral white light for accurate colors'
    );
  });

  test('identifies composition as primary issue', () => {
    const qualityScores = [
      createQualityResult(false, [{ type: 'composition', severity: 'medium' }]),
    ];

    const guidance = generateRetakeGuidance(qualityScores);

    expect(guidance.primaryIssue).toBe('composition');
    expect(guidance.tips).toContain('Fill the frame with the affected leaf');
  });

  test('prioritizes high severity over medium severity', () => {
    const qualityScores = [
      createQualityResult(false, [
        { type: 'blur', severity: 'high' },
        { type: 'exposure', severity: 'medium' },
      ]),
    ];

    const guidance = generateRetakeGuidance(qualityScores);

    expect(guidance.primaryIssue).toBe('blur');
    expect(guidance.severity).toBe('high');
  });

  test('prioritizes medium severity over low severity', () => {
    const qualityScores = [
      createQualityResult(false, [
        { type: 'composition', severity: 'medium' },
        { type: 'focus', severity: 'low' },
      ]),
    ];

    const guidance = generateRetakeGuidance(qualityScores);

    expect(guidance.primaryIssue).toBe('composition');
    expect(guidance.severity).toBe('medium');
  });

  test('uses frequency as tiebreaker for same severity', () => {
    const qualityScores = [
      createQualityResult(false, [
        { type: 'blur', severity: 'medium' },
        { type: 'exposure', severity: 'medium' },
      ]),
      createQualityResult(false, [{ type: 'exposure', severity: 'medium' }]),
    ];

    const guidance = generateRetakeGuidance(qualityScores);

    // Exposure appears twice, blur once
    expect(guidance.primaryIssue).toBe('exposure');
  });

  test('aggregates issues across multiple photos', () => {
    const qualityScores = [
      createQualityResult(false, [{ type: 'blur', severity: 'low' }]),
      createQualityResult(false, [{ type: 'blur', severity: 'high' }]),
    ];

    const guidance = generateRetakeGuidance(qualityScores);

    expect(guidance.primaryIssue).toBe('blur');
    expect(guidance.severity).toBe('high'); // Takes max severity
  });

  test('returns unknown issue when no issues present', () => {
    const qualityScores = [createQualityResult(true, [])];

    const guidance = generateRetakeGuidance(qualityScores);

    expect(guidance.primaryIssue).toBe('unknown');
    expect(guidance.severity).toBe('low');
    expect(guidance.tips.length).toBeGreaterThan(0);
  });

  test('provides specific tips for each issue type', () => {
    const issueTypes = [
      'blur',
      'exposure',
      'white_balance',
      'composition',
      'focus',
      'lighting',
    ];

    for (const issueType of issueTypes) {
      const qualityScores = [
        createQualityResult(false, [{ type: issueType, severity: 'medium' }]),
      ];

      const guidance = generateRetakeGuidance(qualityScores);

      expect(guidance.tips.length).toBeGreaterThan(0);
      expect(guidance.tips.every((tip) => typeof tip === 'string')).toBe(true);
    }
  });
});

describe('shouldRecommendRetake', () => {
  test('recommends retake when any photo is unacceptable', () => {
    const qualityScores = [
      createQualityResult(true, []),
      createQualityResult(false, [{ type: 'blur', severity: 'high' }]),
    ];

    expect(shouldRecommendRetake(qualityScores)).toBe(true);
  });

  test('does not recommend retake when all photos are acceptable', () => {
    const qualityScores = [
      createQualityResult(true, []),
      createQualityResult(true, []),
    ];

    expect(shouldRecommendRetake(qualityScores)).toBe(false);
  });

  test('recommends retake when all photos are unacceptable', () => {
    const qualityScores = [
      createQualityResult(false, [{ type: 'blur', severity: 'high' }]),
      createQualityResult(false, [{ type: 'exposure', severity: 'high' }]),
    ];

    expect(shouldRecommendRetake(qualityScores)).toBe(true);
  });
});

describe('getIssueDescription', () => {
  test('returns correct description for blur', () => {
    expect(getIssueDescription('blur')).toBe('Photo is too blurry');
  });

  test('returns correct description for exposure', () => {
    expect(getIssueDescription('exposure')).toBe(
      'Photo is over or under-exposed'
    );
  });

  test('returns correct description for white_balance', () => {
    expect(getIssueDescription('white_balance')).toBe('Color balance is off');
  });

  test('returns correct description for composition', () => {
    expect(getIssueDescription('composition')).toBe(
      'Photo composition needs improvement'
    );
  });

  test('returns correct description for focus', () => {
    expect(getIssueDescription('focus')).toBe('Photo is out of focus');
  });

  test('returns correct description for non_cannabis_subject', () => {
    expect(getIssueDescription('non_cannabis_subject')).toBe(
      'Photo does not show cannabis plant'
    );
  });

  test('returns generic description for unknown', () => {
    expect(getIssueDescription('unknown')).toBe(
      'Photo quality could be improved'
    );
  });
});
