import { buildIssue } from '../issues';
import type {
  ImageLumaData,
  QualityMetricScore,
  QualityThresholds,
} from '../types';

function computeCoverage(data: ImageLumaData) {
  const { width, height, pixels } = data;
  const totalPixels = width * height;

  let plantPixels = 0;
  let centerPlantPixels = 0;

  const centerStartX = Math.floor(width * 0.25);
  const centerEndX = Math.ceil(width * 0.75);
  const centerStartY = Math.floor(height * 0.25);
  const centerEndY = Math.ceil(height * 0.75);

  const centerWidth = centerEndX - centerStartX;
  const centerHeight = centerEndY - centerStartY;
  const centerArea = centerWidth * centerHeight;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];

      const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
      const saturation = Math.max(r, g, b) - Math.min(r, g, b);

      if (brightness < 220 && saturation > 15) {
        plantPixels += 1;
        if (
          x >= centerStartX &&
          x <= centerEndX &&
          y >= centerStartY &&
          y <= centerEndY
        ) {
          centerPlantPixels += 1;
        }
      }
    }
  }

  return {
    coverage: plantPixels / totalPixels,
    centerCoverage: centerPlantPixels / centerArea,
  };
}

export function analyzeComposition(
  data: ImageLumaData,
  thresholds: QualityThresholds
): QualityMetricScore {
  const { coverage, centerCoverage } = computeCoverage(data);
  const { minPlantCoverage, minCenterCoverage } = thresholds.composition;

  const coverageScore = Math.max(0, Math.min(1, coverage / minPlantCoverage));
  const centerScore = Math.max(
    0,
    Math.min(1, centerCoverage / minCenterCoverage)
  );
  const score = Math.max(
    0,
    Math.min(100, ((coverageScore + centerScore) / 2) * 100)
  );

  if (coverage >= minPlantCoverage && centerCoverage >= minCenterCoverage) {
    return { score };
  }

  const severity = score < 50 ? 'high' : 'medium';

  return {
    score,
    issue: buildIssue({
      type: 'composition',
      severity,
      suggestion: 'assessment.camera.quality.composition',
    }),
  };
}
