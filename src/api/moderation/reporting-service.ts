/**
 * Reporting Service - DSA-compliant content reporting API
 *
 * Implements Art. 16 Notice-and-Action with:
 * - Two-track intake (illegal vs policy violation)
 * - Server-side validation with actionable errors
 * - Duplicate suppression
 * - Content snapshot capture
 * - Priority classification
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.6, 1.8
 */

import { client } from '@/api/common';
import { categorizeError } from '@/lib/error-handling';
import { generateContentHash } from '@/lib/moderation/content-snapshot';
import { classifyReportPriority } from '@/lib/moderation/priority-classifier';
import {
  validateContentReportInput,
  type ValidationResult,
} from '@/lib/moderation/validation';
import type {
  ContentReport,
  ContentReportInput,
  ReportStatus,
  ReportSubmissionResult,
} from '@/types/moderation';

// ============================================================================
// API Endpoints
// ============================================================================

const ENDPOINTS = {
  SUBMIT_REPORT: '/moderation/reports',
  GET_REPORT_STATUS: (reportId: string) => `/moderation/reports/${reportId}`,
  GET_USER_REPORTS: '/moderation/reports/user',
} as const;

// ============================================================================
// Reporting Service Functions
// ============================================================================

/**
 * Prepares report submission payload with validation and classification
 */
async function prepareReportSubmission(
  input: ContentReportInput,
  currentUserId: string,
  isTrustedFlagger: boolean
): Promise<any> {
  // Step 1: Client-side validation
  const validationResult = validateContentReportInput(input);

  if (!validationResult.is_valid) {
    throw new Error(
      `Validation failed: ${validationResult.errors.map((e) => e.message).join(', ')}`
    );
  }

  // Step 2: Generate content hash (if not provided)
  let contentHash = (input as any).content_hash;
  if (!contentHash) {
    // In real implementation, fetch content and hash it
    // For now, use a placeholder
    contentHash = await generateContentHash(JSON.stringify(input.content_id));
  }

  // Step 3: Priority classification
  const priorityClassification = classifyReportPriority({
    reportType: input.report_type,
    contentType: input.content_type,
    explanation: input.explanation,
    legalReference: input.legal_reference,
    trustedFlagger: isTrustedFlagger,
    reportCount: 1, // Single report for now
  });

  // Step 4: Prepare submission payload
  return {
    ...input,
    content_hash: contentHash,
    reporter_id: currentUserId,
    trusted_flagger: isTrustedFlagger,
    priority: priorityClassification.priority,
    sla_deadline: priorityClassification.sla_deadline.toISOString(),
    status: 'pending' as ReportStatus,
  };
}

/**
 * Handles errors from report submission
 */
function handleReportSubmissionError(
  error: unknown,
  contextId: string,
  endpoint: string
): never {
  const categorizedError = categorizeError(error);
  console.error(`Reporting API Error [${endpoint}]`, {
    contextId,
    error: categorizedError,
  });

  // Throw user-friendly error messages
  if (categorizedError.category === 'validation') {
    throw new Error(
      `Validation error: ${categorizedError.message || 'Please check your input and try again.'}`
    );
  } else if (categorizedError.category === 'permission') {
    throw new Error('You do not have permission to submit this report.');
  } else if (categorizedError.category === 'rate_limit') {
    throw new Error('Too many reports submitted. Please try again later.');
  } else if (categorizedError.category === 'conflict') {
    throw new Error(
      'A report for this content already exists. Please check your existing reports.'
    );
  } else if (categorizedError.category === 'network') {
    throw new Error(
      'Network error while submitting report. Please check your connection and try again.'
    );
  } else {
    throw new Error(
      'Failed to submit report. Please try again or contact support if the issue persists.'
    );
  }
}

/**
 * Submits a content report with DSA Art. 16 validation
 *
 * Flow:
 * 1. Client-side validation
 * 2. Content hash generation
 * 3. Priority classification
 * 4. Server submission
 *
 * @param input - Content report input
 * @param currentUserId - ID of the reporting user
 * @param isTrustedFlagger - Whether user is a trusted flagger
 * @returns Report submission result
 */
export async function submitContentReport(
  input: ContentReportInput,
  currentUserId: string,
  isTrustedFlagger: boolean = false
): Promise<ReportSubmissionResult> {
  const endpoint = ENDPOINTS.SUBMIT_REPORT;
  const contextId = `contentId: ${input.content_id}`;

  try {
    const submissionPayload = await prepareReportSubmission(
      input,
      currentUserId,
      isTrustedFlagger
    );

    const response = await client.post(endpoint, submissionPayload);

    // Validate response
    if (response.status < 200 || response.status >= 300) {
      const error = new Error(
        `Failed to submit report (${contextId}): HTTP ${response.status}`
      );
      console.error(`Reporting API Error [${endpoint}]`, {
        contextId,
        status: response.status,
      });
      throw error;
    }

    return response.data as ReportSubmissionResult;
  } catch (error) {
    handleReportSubmissionError(error, contextId, endpoint);
  }
}

/**
 * Gets the status of a submitted report
 *
 * @param reportId - ID of the report
 * @returns Report status information
 */
export async function getReportStatus(
  reportId: string
): Promise<ContentReport> {
  const endpoint = ENDPOINTS.GET_REPORT_STATUS(reportId);

  try {
    const response = await client.get(endpoint);

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Failed to get report status: HTTP ${response.status}`);
    }

    return mapReportDates(response.data as ContentReport);
  } catch (error) {
    const categorizedError = categorizeError(error);
    console.error(`Reporting API Error [${endpoint}]`, {
      reportId,
      error: categorizedError,
    });

    if (categorizedError.category === 'permission') {
      throw new Error('You do not have permission to view this report.');
    } else {
      throw new Error('Failed to retrieve report status.');
    }
  }
}

/**
 * Gets all reports submitted by the current user
 *
 * @returns Array of user's reports
 */
export async function getUserReports(): Promise<ContentReport[]> {
  const endpoint = ENDPOINTS.GET_USER_REPORTS;

  try {
    const response = await client.get(endpoint);

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Failed to get user reports: HTTP ${response.status}`);
    }

    return (response.data.reports as ContentReport[]).map(mapReportDates);
  } catch (error) {
    const categorizedError = categorizeError(error);
    console.error(`Reporting API Error [${endpoint}]`, {
      error: categorizedError,
    });

    if (categorizedError.category === 'permission') {
      throw new Error('You do not have permission to view reports.');
    } else {
      throw new Error('Failed to retrieve your reports.');
    }
  }
}

/**
 * Validates report input and returns validation result
 *
 * This is a convenience function for client-side validation
 * before submission
 *
 * @param input - Content report input
 * @returns Validation result
 */
export function validateReport(input: ContentReportInput): ValidationResult {
  return validateContentReportInput(input);
}

// ============================================================================
// Date Mapping Utilities
// ============================================================================

function mapReportDates(r: ContentReport): ContentReport {
  return {
    ...r,
    sla_deadline: new Date(r.sla_deadline),
    created_at: new Date(r.created_at),
    updated_at: new Date(r.updated_at),
    deleted_at: r.deleted_at ? new Date(r.deleted_at) : undefined,
  };
}
