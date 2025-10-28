import type { QualityIssueType, QualityResult } from '@/types/assessment';

export type RetakeGuidance = {
  primaryIssue: QualityIssueType;
  tips: string[];
  severity: 'high' | 'medium' | 'low';
};

/**
 * Generates retake guidance based on quality assessment results.
 * Prioritizes the most severe quality issue and provides specific tips.
 *
 * @param qualityScores - Array of quality results from assessment photos
 * @returns Retake guidance with primary issue and actionable tips
 */
export function generateRetakeGuidance(
  qualityScores: QualityResult[]
): RetakeGuidance {
  // Find the most severe issue across all photos
  const primaryIssue = findPrimaryQualityIssue(qualityScores);

  // Generate tips based on the primary issue
  const tips = getTipsForIssue(primaryIssue.type);

  return {
    primaryIssue: primaryIssue.type,
    tips,
    severity: primaryIssue.severity,
  };
}

/**
 * Finds the most severe quality issue across all quality results.
 * Prioritizes by severity (high > medium > low) and frequency.
 */
function findPrimaryQualityIssue(qualityScores: QualityResult[]): {
  type: QualityIssueType;
  severity: 'high' | 'medium' | 'low';
} {
  // Flatten all issues from all photos
  const allIssues = qualityScores.flatMap((score) => score.issues);

  if (allIssues.length === 0) {
    // No issues found, return generic unknown
    return { type: 'unknown', severity: 'low' };
  }

  // Count issues by type and track highest severity
  const issueMap = new Map<
    QualityIssueType,
    { count: number; maxSeverity: 'high' | 'medium' | 'low' }
  >();

  for (const issue of allIssues) {
    const existing = issueMap.get(issue.type);
    const severityRank = getSeverityRank(issue.severity);

    if (!existing) {
      issueMap.set(issue.type, {
        count: 1,
        maxSeverity: issue.severity,
      });
    } else {
      existing.count += 1;
      if (severityRank > getSeverityRank(existing.maxSeverity)) {
        existing.maxSeverity = issue.severity;
      }
    }
  }

  // Find issue with highest severity, then by frequency
  let primaryIssue: {
    type: QualityIssueType;
    severity: 'high' | 'medium' | 'low';
  } = { type: 'unknown', severity: 'low' };
  let highestScore = -1;

  for (const [type, data] of issueMap.entries()) {
    const severityRank = getSeverityRank(data.maxSeverity);
    const score = severityRank * 100 + data.count;

    if (score > highestScore) {
      highestScore = score;
      primaryIssue = { type, severity: data.maxSeverity };
    }
  }

  return primaryIssue;
}

/**
 * Converts severity string to numeric rank for comparison
 */
function getSeverityRank(severity: 'high' | 'medium' | 'low'): number {
  switch (severity) {
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
      return 1;
    default:
      return 0;
  }
}

/**
 * Returns specific tips for each quality issue type
 */
function getTipsForIssue(issueType: QualityIssueType): string[] {
  switch (issueType) {
    case 'blur':
      return [
        'Hold your phone steady or use a tripod',
        'Enable macro focus mode if available',
        'Get closer to the subject for better focus',
        'Tap on the leaf to focus before taking the photo',
        'Avoid moving the camera while capturing',
      ];

    case 'exposure':
      return [
        'Adjust lighting to avoid over/under-exposure',
        'Avoid direct LED grow lights in the frame',
        'Use natural light or diffused artificial light',
        'Tap on the leaf to adjust exposure automatically',
        'Take photo during the day if possible',
      ];

    case 'white_balance':
    case 'lighting':
      return [
        'Use neutral white light for accurate colors',
        'Avoid colored LED grow lights (purple/red)',
        'Turn off grow lights temporarily if possible',
        'Use natural daylight for best color accuracy',
        'Avoid mixed lighting sources',
      ];

    case 'composition':
    case 'frame':
      return [
        'Fill the frame with the affected leaf',
        'Remove background clutter and distractions',
        'Capture the entire affected area',
        'Get close enough to see leaf details',
        'Center the problem area in the frame',
      ];

    case 'focus':
      return [
        'Enable macro mode for close-up shots',
        'Tap on the leaf to focus before capturing',
        'Ensure the affected area is in sharp focus',
        'Hold the phone steady while focusing',
        'Get closer if the subject appears blurry',
      ];

    case 'non_cannabis_subject':
      return [
        'Ensure the photo shows cannabis plant leaves',
        'Focus on the affected plant parts',
        'Remove non-plant objects from the frame',
        'Capture leaves with visible issues',
      ];

    case 'unknown':
    default:
      return [
        'Ensure good lighting and focus',
        'Fill the frame with the affected leaf',
        'Hold the phone steady',
        'Use macro mode for close-ups',
        'Avoid colored grow lights',
      ];
  }
}

/**
 * Checks if retake is recommended based on quality scores
 */
export function shouldRecommendRetake(qualityScores: QualityResult[]): boolean {
  // Recommend retake if any photo is unacceptable
  return qualityScores.some((score) => !score.acceptable);
}

/**
 * Gets a user-friendly description of the quality issue
 */
export function getIssueDescription(issueType: QualityIssueType): string {
  switch (issueType) {
    case 'blur':
      return 'Photo is too blurry';
    case 'exposure':
      return 'Photo is over or under-exposed';
    case 'white_balance':
      return 'Color balance is off';
    case 'lighting':
      return 'Lighting conditions are poor';
    case 'composition':
      return 'Photo composition needs improvement';
    case 'frame':
      return 'Subject is not properly framed';
    case 'focus':
      return 'Photo is out of focus';
    case 'non_cannabis_subject':
      return 'Photo does not show cannabis plant';
    case 'unknown':
    default:
      return 'Photo quality could be improved';
  }
}
