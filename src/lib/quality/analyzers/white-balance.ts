import { buildIssue } from '../issues';
import type {
  ImageLumaData,
  QualityMetricScore,
  QualityThresholds,
} from '../types';

const EPSILON = 1e-6;

function computeChannelMeans(pixels: Uint8Array) {
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  const pixelCount = pixels.length / 4;

  for (let i = 0; i < pixels.length; i += 4) {
    rSum += pixels[i];
    gSum += pixels[i + 1];
    bSum += pixels[i + 2];
  }

  return {
    rMean: rSum / pixelCount,
    gMean: gSum / pixelCount,
    bMean: bSum / pixelCount,
  };
}

function computeChromaticityDeviation({
  rMean,
  gMean,
  bMean,
}: ReturnType<typeof computeChannelMeans>) {
  const total = rMean + gMean + bMean + EPSILON;
  const rNorm = rMean / total;
  const gNorm = gMean / total;
  const bNorm = bMean / total;

  const neutral = 1 / 3;
  const deviation = Math.sqrt(
    (rNorm - neutral) ** 2 + (gNorm - neutral) ** 2 + (bNorm - neutral) ** 2
  );

  return { deviation, chroma: { rNorm, gNorm, bNorm } };
}

export function analyzeWhiteBalance(
  data: ImageLumaData,
  thresholds: QualityThresholds
): QualityMetricScore {
  const pixelCount = data.pixels.length / 4;

  // Validate pixel buffer before computing means
  if (pixelCount === 0 || data.pixels.length % 4 !== 0) {
    return {
      score: 0,
      issue: buildIssue({
        type: 'white_balance',
        severity: 'high',
        suggestion: 'assessment.camera.quality.white_balance',
      }),
    };
  }

  const means = computeChannelMeans(data.pixels);
  const { deviation } = computeChromaticityDeviation(means);

  const { maxDeviation, severeDeviation } = thresholds.whiteBalance;
  const normalized = Math.max(0, 1 - deviation / maxDeviation);
  const score = Math.max(0, Math.min(100, normalized * 100));

  if (deviation <= maxDeviation) {
    return { score };
  }

  const severity = deviation >= severeDeviation ? 'high' : 'medium';

  return {
    score,
    issue: buildIssue({
      type: 'white_balance',
      severity,
      suggestion: 'assessment.camera.quality.white_balance',
    }),
  };
}
