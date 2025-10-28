import { buildIssue } from '../issues';
import type {
  ImageLumaData,
  QualityMetricScore,
  QualityThresholds,
} from '../types';

function buildHistogram(luma: Uint8Array): number[] {
  const histogram = new Array<number>(256).fill(0);
  for (let i = 0; i < luma.length; i += 1) {
    histogram[luma[i]] += 1;
  }
  return histogram;
}

function computeExposureRatios(histogram: number[], totalPixels: number) {
  const underLimit = 32;
  const overLimit = 224;

  let underExposed = 0;
  let overExposed = 0;
  let weightedSum = 0;

  for (let i = 0; i < histogram.length; i += 1) {
    const count = histogram[i];
    weightedSum += i * count;

    if (i <= underLimit) {
      underExposed += count;
    } else if (i >= overLimit) {
      overExposed += count;
    }
  }

  const average = weightedSum / totalPixels;
  return {
    underRatio: underExposed / totalPixels,
    overRatio: overExposed / totalPixels,
    averageLuma: average,
  };
}

export function analyzeExposure(
  data: ImageLumaData,
  thresholds: QualityThresholds
): QualityMetricScore {
  const histogram = buildHistogram(data.luma);
  const { underRatio, overRatio, averageLuma } = computeExposureRatios(
    histogram,
    data.luma.length
  );

  const { underExposureMaxRatio, overExposureMaxRatio, acceptableRange } =
    thresholds.exposure;

  // Runtime validation to prevent division by zero
  if (underExposureMaxRatio <= 0 || overExposureMaxRatio <= 0) {
    return {
      score: 0,
      issue: buildIssue({
        type: 'exposure',
        severity: 'high',
        suggestion: 'assessment.camera.quality.exposure',
      }),
    };
  }

  const rangeHalf = acceptableRange[1] - acceptableRange[0];
  if (rangeHalf <= 0) {
    return {
      score: 0,
      issue: buildIssue({
        type: 'exposure',
        severity: 'high',
        suggestion: 'assessment.camera.quality.exposure',
      }),
    };
  }

  const underScore = Math.max(0, 1 - underRatio / underExposureMaxRatio);
  const overScore = Math.max(0, 1 - overRatio / overExposureMaxRatio);
  const rangeCenter = (acceptableRange[0] + acceptableRange[1]) / 2;
  const deviation = Math.abs(averageLuma / 255 - rangeCenter);
  const balanceScore = Math.max(0, 1 - deviation / rangeHalf);

  const score = Math.max(
    0,
    Math.min(100, ((underScore + overScore + balanceScore) / 3) * 100)
  );

  if (
    underRatio <= underExposureMaxRatio &&
    overRatio <= overExposureMaxRatio &&
    averageLuma / 255 >= acceptableRange[0] &&
    averageLuma / 255 <= acceptableRange[1]
  ) {
    return { score };
  }

  const severity = score < 40 ? 'high' : 'medium';

  return {
    score,
    issue: buildIssue({
      type: 'exposure',
      severity,
      suggestion: 'assessment.camera.quality.exposure',
    }),
  };
}
