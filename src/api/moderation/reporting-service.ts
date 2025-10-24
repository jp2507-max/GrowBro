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

import {
  CryptoDigestAlgorithm,
  CryptoEncoding,
  digestStringAsync,
} from 'expo-crypto';

import { client } from '@/api/common';
import { getCommunityApiClient } from '@/api/community';
import { categorizeError } from '@/lib/error-handling';
import { generateContentHash } from '@/lib/moderation/content-snapshot';
import {
  classifyReportPriority,
  PRIORITY,
} from '@/lib/moderation/priority-classifier';
import {
  type DetailedValidationResult,
  validateContentReportInput,
} from '@/lib/moderation/validation';
import type {
  ContentReport,
  ContentReportInput,
  ContentType,
  ModerationPriority,
  ReportStatus,
  ReportSubmissionResult,
} from '@/types/moderation';

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generates a deterministic Idempotency-Key for report submissions
 *
 * @param contentId - The content identifier
 * @param reporterId - The reporter's user ID
 * @param contentHash - Optional content hash for additional stability
 * @returns SHA-256 hash string to use as Idempotency-Key
 */
async function generateIdempotencyKey(
  contentId: string,
  reporterId: string,
  contentHash?: string
): Promise<string> {
  const data = `${contentId}:${reporterId}:${contentHash || ''}`;
  const hash = await digestStringAsync(CryptoDigestAlgorithm.SHA256, data, {
    encoding: CryptoEncoding.HEX,
  });
  return hash;
}

// ============================================================================
// Types
// ============================================================================

interface ReportSubmissionPayload extends ContentReportInput {
  content_hash: string;
  reporter_id: string;
  trusted_flagger: boolean;
  priority: ModerationPriority;
  sla_deadline: string;
  status: ReportStatus;
}

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
 * Fetches content string by ID and content type for hash generation
 *
 * @param contentId - The content identifier
 * @param contentType - The type of content
 * @returns Content string or null if not found
 */
async function fetchContentForHash(
  contentId: string,
  contentType: ContentType
): Promise<string | null> {
  try {
    const communityApi = getCommunityApiClient();

    switch (contentType) {
      case 'post': {
        const post = await communityApi.getPost(contentId);
        return post.body || null;
      }

      case 'comment': {
        // For comments, we need to fetch from the database directly since
        // there's no single comment fetch method in the API client
        const { data, error } = await communityApi['client']
          .from('post_comments')
          .select('body')
          .eq('id', contentId)
          .is('deleted_at', null)
          .is('hidden_at', null)
          .single();

        if (error || !data) {
          return null;
        }

        return data.body || null;
      }

      case 'profile': {
        const profile = await communityApi.getUserProfile(contentId);
        // For profiles, concatenate relevant fields for hash
        return `${profile.username || ''} ${profile.bio || ''}`.trim() || null;
      }

      case 'image':
        // For images, we can't easily fetch the content body, so return null
        // The server will need to handle image hash generation
        return null;

      case 'other':
      default:
        // For other content types, we can't fetch content
        return null;
    }
  } catch (error) {
    console.warn(
      `Failed to fetch content for hash generation: ${contentId} (${contentType})`,
      error
    );
    return null;
  }
}

/**
 * Prepares report submission payload with validation and classification
 */
async function prepareReportSubmission(
  input: ContentReportInput,
  currentUserId: string,
  isTrustedFlagger: boolean
): Promise<ReportSubmissionPayload> {
  // Step 1: Client-side validation
  const validationResult = validateContentReportInput(input);

  if (!validationResult.is_valid) {
    throw new Error(
      `Validation failed: ${validationResult.errors.map((e) => e.message).join(', ')}`
    );
  }

  // Step 2: Generate content hash (if not provided)
  let contentHash: string | undefined = input.content_hash;
  if (!contentHash) {
    // Try to get content for hash generation
    let contentString: string | null = null;

    // First, check if content was provided directly
    if (input.content) {
      contentString = input.content;
    } else {
      // Otherwise, fetch content by ID and type
      contentString = await fetchContentForHash(
        input.content_id,
        input.content_type
      );
    }

    // Generate hash from content if we have it, otherwise leave undefined
    if (contentString) {
      contentHash = await generateContentHash(contentString);
    }
    // If contentString is null, contentHash remains undefined so server can compute it
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
  let priorityString: ModerationPriority;
  if (priorityClassification.priority === PRIORITY.IMMEDIATE) {
    priorityString = 'immediate';
  } else if (priorityClassification.priority === PRIORITY.HIGH) {
    priorityString = isTrustedFlagger ? 'trusted' : 'illegal';
  } else {
    priorityString = 'standard';
  }

  return {
    ...input,
    content_hash: contentHash || '',
    reporter_id: currentUserId,
    trusted_flagger: isTrustedFlagger,
    priority: priorityString,
    sla_deadline: priorityClassification.sla_deadline.toISOString(),
    status: 'pending' as ReportStatus,
  };
}

/**
 * Handles errors from report submission
 */
function handleReportSubmissionError(
  error: unknown,
  {
    contextId,
    endpoint,
    idempotencyKey,
  }: {
    contextId: string;
    endpoint: string;
    idempotencyKey?: string;
  }
): never {
  const categorizedError = categorizeError(error);
  console.error(`Reporting API Error [${endpoint}]`, {
    contextId,
    idempotencyKey,
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

  let idempotencyKey: string | undefined;

  try {
    const submissionPayload = await prepareReportSubmission(
      input,
      currentUserId,
      isTrustedFlagger
    );

    idempotencyKey = await generateIdempotencyKey(
      input.content_id,
      currentUserId,
      submissionPayload.content_hash
    );

    const response = await client.post(endpoint, submissionPayload, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });

    // Validate response
    if (response.status < 200 || response.status >= 300) {
      const error = new Error(
        `Failed to submit report (${contextId}): HTTP ${response.status}`
      );
      console.error(`Reporting API Error [${endpoint}]`, {
        contextId,
        idempotencyKey,
        status: response.status,
      });
      throw error;
    }

    return response.data as ReportSubmissionResult;
  } catch (error) {
    handleReportSubmissionError(error, { contextId, endpoint, idempotencyKey });
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
export function validateReport(
  input: ContentReportInput
): DetailedValidationResult {
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
