import { buildIssue } from '../issues';
import type {
  ImageLumaData,
  QualityMetricScore,
  QualityThresholds,
} from '../types';

const LAPLACIAN_KERNEL = [-1, -1, -1, -1, 8, -1, -1, -1, -1];

function computeVarianceOfLaplacian(data: ImageLumaData): number {
  const { width, height, luma } = data;

  if (width < 3 || height < 3) {
    return 0;
  }

  const stride = Math.max(1, Math.floor(Math.min(width, height) / 256));

  const laplacianValues: number[] = [];
  for (let y = 1; y < height - 1; y += stride) {
    for (let x = 1; x < width - 1; x += stride) {
      const center = y * width + x;
      const top = center - width;
      const bottom = center + width;

      const neighbors = [
        top - 1,
        top,
        top + 1,
        center - 1,
        center,
        center + 1,
        bottom - 1,
        bottom,
        bottom + 1,
      ];

      let sum = 0;
      for (let i = 0; i < neighbors.length; i += 1) {
        sum += LAPLACIAN_KERNEL[i] * luma[neighbors[i]];
      }
      laplacianValues.push(sum);
    }
  }

  if (laplacianValues.length === 0) {
    return 0;
  }

  const mean =
    laplacianValues.reduce((acc, value) => acc + value, 0) /
    laplacianValues.length;
  const variance =
    laplacianValues.reduce((acc, value) => {
      const diff = value - mean;
      return acc + diff * diff;
    }, 0) / laplacianValues.length;

  return variance;
}

export function analyzeBlur(
  data: ImageLumaData,
  thresholds: QualityThresholds
): QualityMetricScore {
  const variance = computeVarianceOfLaplacian(data);
  const { minVariance, severeVariance } = thresholds.blur;

  if (variance <= 0) {
    return {
      score: 0,
      issue: buildIssue({
        type: 'blur',
        severity: 'high',
        suggestion: 'assessment.camera.quality.blur',
      }),
    };
  }

  const normalized = Math.min(variance / minVariance, 1);
  const score = Math.max(0, Math.min(100, normalized * 100));

  if (variance >= minVariance) {
    return { score };
  }

  const severity = variance < severeVariance ? 'high' : 'medium';

  return {
    score,
    issue: buildIssue({
      type: 'blur',
      severity,
      suggestion: 'assessment.camera.quality.blur',
    }),
  };
}
