import type { QualityIssue, QualityResult } from '@/types/assessment';

import { analyzeBlur } from './analyzers/blur';
import { analyzeComposition } from './analyzers/composition';
import { analyzeExposure } from './analyzers/exposure';
import { analyzeWhiteBalance } from './analyzers/white-balance';
import { getQualityThresholds } from './config';
import { readImageLumaData } from './image-loader';
import { buildIssue } from './issues';
import type {
  BatchPhotoInput,
  BatchQualityPhoto,
  BatchQualityResult,
  ImageLumaData,
  QualityAssessmentEngine,
  QualityMetricAnalyzer,
} from './types';

const analyzers: {
  analyzer: QualityMetricAnalyzer;
  key: keyof ReturnType<typeof getQualityThresholds>;
}[] = [
  { analyzer: analyzeBlur, key: 'blur' },
  { analyzer: analyzeExposure, key: 'exposure' },
  { analyzer: analyzeWhiteBalance, key: 'whiteBalance' },
  { analyzer: analyzeComposition, key: 'composition' },
];

function dedupeIssues(issues: QualityIssue[]): QualityIssue[] {
  const byType = new Map<string, QualityIssue>();
  for (const issue of issues) {
    const existing = byType.get(issue.type);
    if (!existing) {
      byType.set(issue.type, issue);
      continue;
    }
    const next = issue.severity === 'high' ? issue : existing;
    byType.set(issue.type, next);
  }
  return [...byType.values()];
}

function combineScore(weights: number[], scores: number[]): number {
  let weightSum = 0;
  let weighted = 0;
  for (let i = 0; i < scores.length; i += 1) {
    const weight = weights[i] ?? 0;
    weightSum += weight;
    weighted += scores[i] * weight;
  }
  return weightSum === 0 ? 0 : weighted / weightSum;
}

export async function assessData(data: ImageLumaData): Promise<QualityResult> {
  const thresholds = getQualityThresholds();
  const scores: number[] = [];
  const weights: number[] = [];
  const issues: QualityIssue[] = [];

  for (const { analyzer, key } of analyzers) {
    const result = analyzer(data, thresholds);
    scores.push(result.score);
    const thresholdConfig = thresholds[key];
    weights.push(
      thresholdConfig !== null &&
        typeof thresholdConfig === 'object' &&
        'weight' in thresholdConfig
        ? Number.isFinite(thresholdConfig.weight)
          ? thresholdConfig.weight
          : 0
        : 0
    );
    if (result.issue) {
      issues.push(result.issue);
    }
  }

  // Combine individual analyzer scores (0-100) using weighted average
  // Result is also in 0-100 range, matching threshold scales
  const aggregate = combineScore(weights, scores);
  const acceptable = aggregate >= thresholds.acceptableScore;
  const borderline = !acceptable && aggregate >= thresholds.borderlineScore;

  const finalIssues = acceptable
    ? []
    : borderline
      ? dedupeIssues(issues.map((issue) => ({ ...issue, severity: 'medium' })))
      : dedupeIssues(
          issues.length > 0
            ? issues
            : [
                buildIssue({
                  type: 'composition',
                  severity: 'high',
                  suggestion: 'assessment.camera.quality.composition',
                }),
              ]
        );

  return {
    score: Math.round(aggregate),
    acceptable,
    issues: finalIssues,
  };
}

async function assessPhoto(uri: string): Promise<QualityResult> {
  const imageData = await readImageLumaData(uri);
  return assessData(imageData);
}

function summarizeIssues(photos: BatchQualityPhoto[]): Record<string, number> {
  const summary: Record<string, number> = {};
  for (const photo of photos) {
    for (const issue of photo.qualityResult.issues) {
      summary[issue.type] = (summary[issue.type] ?? 0) + 1;
    }
  }
  return summary;
}

async function validateBatch(
  photos: BatchPhotoInput[]
): Promise<BatchQualityResult> {
  const assessedPhotos: BatchQualityPhoto[] = [];
  let totalScore = 0;
  let unacceptableCount = 0;

  for (const photo of photos) {
    const qualityResult = photo.qualityResult ?? (await assessPhoto(photo.uri));
    assessedPhotos.push({ ...photo, qualityResult });
    totalScore += qualityResult.score;
    if (!qualityResult.acceptable) {
      unacceptableCount += 1;
    }
  }

  const averageScore = assessedPhotos.length
    ? Math.round(totalScore / assessedPhotos.length)
    : 0;
  const thresholds = getQualityThresholds();
  const acceptable =
    averageScore >= thresholds.acceptableScore && unacceptableCount === 0;

  return {
    overallScore: averageScore,
    averageScore,
    acceptable,
    unacceptableCount,
    issuesSummary: summarizeIssues(assessedPhotos),
    photos: assessedPhotos,
  };
}

export const qualityAssessmentEngine: QualityAssessmentEngine = {
  assessPhoto,
  validateBatch,
};
