/**
 * Priority classification engine for content reports
 *
 * Implements DSA-compliant priority lanes with SLA enforcement:
 * - Immediate: CSAM, self-harm (Art. 16 expeditious action)
 * - High: Illegal content, trusted flaggers (Art. 22)
 * - Normal: Policy violations
 *
 * Requirements: 1.8, 5.1, 11.1
 */

import type { ContentType, ReportType } from '@/types/moderation';

// ============================================================================
// Priority Constants
// ============================================================================

/**
 * Priority levels (0-100, where 100 is highest)
 */
export const PRIORITY = {
  IMMEDIATE: 100, // CSAM, self-harm, imminent danger
  HIGH: 75, // Illegal content, trusted flaggers
  ELEVATED: 50, // Multiple reports, repeat offenders
  NORMAL: 25, // Policy violations
  LOW: 10, // Spam, minor violations
} as const;

/**
 * SLA deadlines in hours
 */
export const SLA_HOURS = {
  IMMEDIATE: 0, // Act immediately (in practice: minutes)
  ILLEGAL: 24, // Act within 24 hours
  POLICY: 72, // Act within 72 hours
} as const;

/**
 * Priority keywords for content analysis
 */
const IMMEDIATE_KEYWORDS = [
  'csam',
  'child abuse',
  'child sexual',
  'suicide',
  'self-harm',
  'imminent danger',
  'active shooter',
  'bomb threat',
];

const ILLEGAL_KEYWORDS = [
  'terrorism',
  'hate speech',
  'incitement to violence',
  'illegal drugs',
  'human trafficking',
  'weapons sale',
];

// ============================================================================
// Priority Classification Functions
// ============================================================================

export interface PriorityClassification {
  priority: number;
  sla_hours: number;
  sla_deadline: Date;
  priority_reason: string;
}

/**
 * Classifies report priority based on multiple factors
 *
 * @param reportType - Type of report (illegal vs policy violation)
 * @param contentType - Type of content
 * @param explanation - Report explanation text
 * @param legalReference - Legal reference (if illegal)
 * @param trustedFlagger - Whether reporter is a trusted flagger
 * @param reportCount - Number of reports for same content
 * @returns Priority classification with SLA deadline
 */
export interface PriorityClassificationInput {
  reportType: ReportType;
  contentType: ContentType;
  explanation: string;
  legalReference?: string;
  trustedFlagger?: boolean;
  reportCount?: number;
}

export function classifyReportPriority(
  input: PriorityClassificationInput
): PriorityClassification {
  const {
    reportType,
    explanation,
    legalReference,
    trustedFlagger = false,
    reportCount = 1,
  } = input;
  const explanationLower = explanation.toLowerCase();

  // IMMEDIATE: CSAM, self-harm, imminent danger
  if (containsKeywords(explanationLower, IMMEDIATE_KEYWORDS)) {
    return createPriorityClassification(
      PRIORITY.IMMEDIATE,
      SLA_HOURS.IMMEDIATE,
      'Immediate action required: CSAM, self-harm, or imminent danger detected'
    );
  }

  // HIGH: Trusted flagger reports
  if (trustedFlagger) {
    const slaHours =
      reportType === 'illegal' ? SLA_HOURS.ILLEGAL : SLA_HOURS.POLICY;
    return createPriorityClassification(
      PRIORITY.HIGH,
      slaHours,
      'Trusted flagger priority lane (DSA Art. 22)'
    );
  }

  // HIGH: Illegal content with legal reference
  if (reportType === 'illegal' && legalReference) {
    return createPriorityClassification(
      PRIORITY.HIGH,
      SLA_HOURS.ILLEGAL,
      `Illegal content: ${legalReference}`
    );
  }

  // HIGH: Illegal content with keywords
  if (
    reportType === 'illegal' &&
    containsKeywords(explanationLower, ILLEGAL_KEYWORDS)
  ) {
    return createPriorityClassification(
      PRIORITY.HIGH,
      SLA_HOURS.ILLEGAL,
      'Illegal content: Matches high-priority violation patterns'
    );
  }

  // ELEVATED: Multiple reports for same content
  if (reportCount >= 3) {
    return createPriorityClassification(
      PRIORITY.ELEVATED,
      SLA_HOURS.POLICY,
      `Elevated priority: ${reportCount} reports for same content`
    );
  }

  // NORMAL: Policy violations
  if (reportType === 'policy_violation') {
    return createPriorityClassification(
      PRIORITY.NORMAL,
      SLA_HOURS.POLICY,
      'Standard policy violation review'
    );
  }

  // DEFAULT: Low priority
  return createPriorityClassification(
    PRIORITY.LOW,
    SLA_HOURS.POLICY,
    'Low priority report'
  );
}

/**
 * Creates priority classification with SLA deadline
 *
 * @param priority - Priority value (0-100)
 * @param slaHours - SLA deadline in hours
 * @param reason - Priority reason description
 * @returns Priority classification object
 */
function createPriorityClassification(
  priority: number,
  slaHours: number,
  reason: string
): PriorityClassification {
  const slaDeadline = calculateSlaDeadline(slaHours);

  return {
    priority,
    sla_hours: slaHours,
    sla_deadline: slaDeadline,
    priority_reason: reason,
  };
}

/**
 * Calculates SLA deadline from current time
 *
 * @param hours - SLA hours (0 for immediate)
 * @returns SLA deadline date
 */
export function calculateSlaDeadline(hours: number): Date {
  const now = new Date();

  if (hours === 0) {
    // Immediate: set deadline to 15 minutes from now
    return new Date(now.getTime() + 15 * 60 * 1000);
  }

  return new Date(now.getTime() + hours * 60 * 60 * 1000);
}

/**
 * Checks if text contains any keywords
 *
 * @param text - Text to search
 * @param keywords - Array of keywords
 * @returns True if any keyword found
 */
function containsKeywords(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

/**
 * Calculates time remaining until SLA deadline
 *
 * @param slaDeadline - SLA deadline date
 * @returns Time remaining in milliseconds
 */
export function calculateTimeRemaining(slaDeadline: Date): number {
  const now = new Date().getTime();
  const deadline = new Date(slaDeadline).getTime();
  return Math.max(deadline - now, 0);
}

/**
 * Determines SLA alert level based on time remaining
 *
 * @param slaDeadline - SLA deadline date
 * @param slaHours - Total SLA hours
 * @returns Alert level ('none', 'warning_75', 'warning_90', 'breached')
 */
export function getSlaAlertLevel(
  slaDeadline: Date,
  slaHours: number
): 'none' | 'warning_75' | 'warning_90' | 'breached' {
  const remainingMs = calculateTimeRemaining(slaDeadline);

  // Handle immediate SLA (0 hours or less) to avoid divide-by-zero
  if (slaHours <= 0) {
    return remainingMs === 0 ? 'breached' : 'warning_90';
  }

  const totalMs = slaHours * 60 * 60 * 1000;

  if (remainingMs === 0) {
    return 'breached';
  }

  const percentRemaining = (remainingMs / totalMs) * 100;

  if (percentRemaining <= 10) {
    return 'warning_90';
  } else if (percentRemaining <= 25) {
    return 'warning_75';
  } else {
    return 'none';
  }
}

/**
 * Formats time remaining in human-readable format
 *
 * @param milliseconds - Time in milliseconds
 * @returns Human-readable time string
 */
export function formatTimeRemaining(milliseconds: number): string {
  if (milliseconds === 0) {
    return 'Overdue';
  }

  const hours = Math.floor(milliseconds / (60 * 60 * 1000));
  const minutes = Math.floor((milliseconds % (60 * 60 * 1000)) / (60 * 1000));

  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''}`;
  } else if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} min`;
  } else {
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  }
}

/**
 * Determines if report should be flagged for immediate review
 *
 * @param priority - Priority classification
 * @returns True if immediate review required
 */
export function requiresImmediateReview(
  priority: PriorityClassification
): boolean {
  return priority.priority === PRIORITY.IMMEDIATE;
}

/**
 * Determines if report qualifies for trusted flagger fast lane
 *
 * @param trustedFlagger - Whether reporter is trusted flagger
 * @param reportType - Type of report
 * @returns True if fast lane applies
 */
export function qualifiesForFastLane(
  trustedFlagger: boolean,
  _reportType: ReportType
): boolean {
  // DSA Art. 22: Trusted flaggers get priority processing
  return trustedFlagger;
}
