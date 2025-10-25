import type {
  QualityIssue,
  QualityIssueSeverity,
  QualityResult,
} from '@/types/assessment';

export type QualityMetricScore = {
  /** Score between 0 and 100 */
  score: number;
  /** Optional quality issue when score falls below threshold */
  issue?: QualityIssue;
};

export type QualityMetricAnalyzer = (
  data: ImageLumaData,
  thresholds: QualityThresholds
) => QualityMetricScore;

export type QualityMetricKey =
  | 'blur'
  | 'exposure'
  | 'whiteBalance'
  | 'composition';

export type ImageLumaData = {
  width: number;
  height: number;
  /**
   * Grayscale luminance values for every pixel (0-255)
   * Stored in row-major order, length === width * height
   */
  luma: Uint8Array;
  /**
   * Raw RGBA pixel data (Uint8Array of length width * height * 4)
   */
  pixels: Uint8Array;
};

export type QualityThresholds = {
  blur: {
    minVariance: number;
    severeVariance: number;
    weight: number;
  };
  exposure: {
    underExposureMaxRatio: number;
    overExposureMaxRatio: number;
    acceptableRange: [number, number];
    weight: number;
  };
  whiteBalance: {
    maxDeviation: number;
    severeDeviation: number;
    weight: number;
  };
  composition: {
    minPlantCoverage: number;
    minCenterCoverage: number;
    weight: number;
  };
  acceptableScore: number;
  borderlineScore: number;
};

export type QualityIssueSummary = Record<string, number>;

export type BatchQualityPhoto = {
  id: string;
  uri: string;
  qualityResult: QualityResult;
};

export type BatchQualityResult = {
  overallScore: number;
  averageScore: number;
  acceptable: boolean;
  unacceptableCount: number;
  issuesSummary: QualityIssueSummary;
  photos: BatchQualityPhoto[];
};

export type QualityAssessmentEngine = {
  assessPhoto: (uri: string) => Promise<QualityResult>;
  validateBatch: (photos: BatchPhotoInput[]) => Promise<BatchQualityResult>;
};

export type BatchPhotoInput = {
  id: string;
  uri: string;
  qualityResult?: QualityResult;
};

export type IssueFactoryArgs = {
  type: QualityIssue['type'];
  severity: QualityIssueSeverity;
  suggestion?: string;
};
