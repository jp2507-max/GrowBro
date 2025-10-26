/**
 * Edge Case Detection for Image Quality
 *
 * Detects problematic image conditions that should trigger retake guidance:
 * - Non-plant images (wrong subject matter)
 * - Extreme close-ups (composition issues)
 * - Heavy LED color cast (lighting issues)
 *
 * Requirements:
 * - 10.3: Detect non-plant images, extreme close-ups, and heavy LED color cast
 */

import type { QualityIssue } from '@/types/assessment';

export type EdgeCaseDetectionResult = {
  isEdgeCase: boolean;
  issues: QualityIssue[];
  retakeGuidance?: string;
};

/**
 * Detect if image is a non-plant subject
 * Uses heuristics based on color channel ratios
 */
export function detectNonPlantImage(imageData: {
  width: number;
  height: number;
  pixels?: Uint8ClampedArray;
}): EdgeCaseDetectionResult {
  // Placeholder implementation - would analyze pixel data in production
  // Heuristic: Check green channel dominance typical of plant matter

  if (!imageData.pixels || imageData.pixels.length === 0) {
    return {
      isEdgeCase: false,
      issues: [],
    };
  }

  const { greenRatio, blueRedRatio } = analyzeColorChannels(imageData.pixels);

  // Plants typically have high green ratio (>0.35) and balanced blue/red
  const isLikelyPlant =
    greenRatio > 0.35 && blueRedRatio > 0.4 && blueRedRatio < 2.5;

  if (!isLikelyPlant) {
    return {
      isEdgeCase: true,
      issues: [
        {
          type: 'non_cannabis_subject',
          severity: 'high',
          suggestion: 'Please capture a photo of your plant leaves',
        },
      ],
      retakeGuidance:
        'The image does not appear to contain plant matter. Please ensure you are photographing plant leaves with visible detail.',
    };
  }

  return {
    isEdgeCase: false,
    issues: [],
  };
}

/**
 * Detect extreme close-up that prevents proper assessment
 * Uses blur variance and composition metrics
 */
export function detectExtremeCloseUp(qualityMetrics: {
  blurScore?: number;
  compositionScore?: number;
  centerFocusRatio?: number;
}): EdgeCaseDetectionResult {
  const { blurScore, compositionScore, centerFocusRatio } = qualityMetrics;

  // Extreme close-ups typically have:
  // - High blur variance in center (shallow depth of field)
  // - Low composition score (poor framing)
  // - Very high center focus ratio (>0.8)

  const hasHighCenterBlur =
    blurScore !== undefined && blurScore < 80 && (centerFocusRatio ?? 0) > 0.8;
  const hasLowComposition =
    compositionScore !== undefined && compositionScore < 40;

  if (hasHighCenterBlur || hasLowComposition) {
    return {
      isEdgeCase: true,
      issues: [
        {
          type: 'composition',
          severity: 'medium',
          suggestion: 'Move camera back for full leaf view',
        },
      ],
      retakeGuidance:
        'The photo appears to be too close. Please move the camera back 15-30cm to capture the full leaf with clear detail.',
    };
  }

  return {
    isEdgeCase: false,
    issues: [],
  };
}

/**
 * Detect heavy LED color cast that affects assessment
 * Uses color temperature deviation from neutral
 */
export function detectHeavyLEDCast(colorMetrics: {
  colorTemperature?: number;
  redChannelDominance?: number;
  blueChannelDominance?: number;
}): EdgeCaseDetectionResult {
  const { colorTemperature, redChannelDominance, blueChannelDominance } =
    colorMetrics;

  // Neutral daylight is ~5500-6500K
  // Heavy LED cast: extreme deviation (>2000K) or strong channel dominance
  const NEUTRAL_TEMP = 6000;
  const MAX_DEVIATION = 2000;

  const hasExtremeTempDeviation =
    colorTemperature !== undefined &&
    Math.abs(colorTemperature - NEUTRAL_TEMP) > MAX_DEVIATION;

  const hasStrongRedCast =
    redChannelDominance !== undefined && redChannelDominance > 0.5;
  const hasStrongBlueCast =
    blueChannelDominance !== undefined && blueChannelDominance > 0.5;

  if (hasExtremeTempDeviation || hasStrongRedCast || hasStrongBlueCast) {
    let castType = 'LED grow light';
    if (hasStrongRedCast) castType = 'red/purple LED';
    if (hasStrongBlueCast) castType = 'blue LED';

    return {
      isEdgeCase: true,
      issues: [
        {
          type: 'lighting',
          severity: 'high',
          suggestion: `Try capturing in natural light or adjust ${castType} intensity`,
        },
      ],
      retakeGuidance: `The photo has a heavy ${castType} color cast. For best results, try capturing during the day with natural light, or temporarily turn off grow lights and use a neutral white light source.`,
    };
  }

  return {
    isEdgeCase: false,
    issues: [],
  };
}

/**
 * Run all edge case detections on an image
 */
export function detectAllEdgeCases(input: {
  imageData?: {
    width: number;
    height: number;
    pixels?: Uint8ClampedArray;
  };
  qualityMetrics?: {
    blurScore?: number;
    compositionScore?: number;
    centerFocusRatio?: number;
  };
  colorMetrics?: {
    colorTemperature?: number;
    redChannelDominance?: number;
    blueChannelDominance?: number;
  };
}): EdgeCaseDetectionResult {
  const allIssues: QualityIssue[] = [];
  const guidanceMessages: string[] = [];

  // Check for non-plant image
  if (input.imageData) {
    const nonPlantResult = detectNonPlantImage(input.imageData);
    if (nonPlantResult.isEdgeCase) {
      allIssues.push(...nonPlantResult.issues);
      if (nonPlantResult.retakeGuidance) {
        guidanceMessages.push(nonPlantResult.retakeGuidance);
      }
    }
  }

  // Check for extreme close-up
  if (input.qualityMetrics) {
    const closeUpResult = detectExtremeCloseUp(input.qualityMetrics);
    if (closeUpResult.isEdgeCase) {
      allIssues.push(...closeUpResult.issues);
      if (closeUpResult.retakeGuidance) {
        guidanceMessages.push(closeUpResult.retakeGuidance);
      }
    }
  }

  // Check for heavy LED cast
  if (input.colorMetrics) {
    const ledCastResult = detectHeavyLEDCast(input.colorMetrics);
    if (ledCastResult.isEdgeCase) {
      allIssues.push(...ledCastResult.issues);
      if (ledCastResult.retakeGuidance) {
        guidanceMessages.push(ledCastResult.retakeGuidance);
      }
    }
  }

  return {
    isEdgeCase: allIssues.length > 0,
    issues: allIssues,
    retakeGuidance:
      guidanceMessages.length > 0 ? guidanceMessages.join('\n\n') : undefined,
  };
}

/**
 * Analyze color channel ratios from pixel data
 */
function analyzeColorChannels(pixels: Uint8ClampedArray): {
  greenRatio: number;
  blueRedRatio: number;
} {
  let totalR = 0;
  let totalG = 0;
  let totalB = 0;
  let pixelCount = 0;

  // Sample every 4th pixel for performance (RGBA format)
  for (let i = 0; i < pixels.length; i += 16) {
    totalR += pixels[i];
    totalG += pixels[i + 1];
    totalB += pixels[i + 2];
    pixelCount++;
  }

  if (pixelCount === 0) {
    return { greenRatio: 0, blueRedRatio: 0 };
  }

  const avgR = totalR / pixelCount;
  const avgG = totalG / pixelCount;
  const avgB = totalB / pixelCount;
  const total = avgR + avgG + avgB;

  const greenRatio = total > 0 ? avgG / total : 0;
  const blueRedRatio = avgR > 0 ? avgB / avgR : 0;

  return { greenRatio, blueRedRatio };
}
