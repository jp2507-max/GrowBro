/**
 * Appeals API - DSA Art. 20 Internal Complaint-Handling
 *
 * API endpoints for:
 * - Appeal submission
 * - Appeal status queries
 * - ODS escalation
 *
 * Requirements: 4.1, 4.2, 4.8, 13.1
 */

import { client } from '@/api/common';
import type {
  Appeal,
  AppealInput,
  AppealSubmissionResult,
  ModerationDecision,
} from '@/types/moderation';

// ============================================================================
// Types
// ============================================================================

export type AppealPayload = AppealInput;

export interface AppealContextResponse {
  appeal: Appeal;
  originalDecision: ModerationDecision;
  policyCitations: string[];
  evidence: string[];
}

export interface ODSEscalationPayload {
  appealId: string;
  odsBodyId: string;
}

export interface ODSEscalationResponse {
  success: boolean;
  escalationId?: string;
  odsBodyName?: string;
  submissionUrl?: string;
  targetResolutionDate?: string;
  error?: string;
}

// ============================================================================
// Appeal Submission
// ============================================================================

/**
 * Submit an appeal for a moderation decision
 *
 * Requirement: 4.1, 4.2
 */
export async function apiSubmitAppeal(
  payload: AppealPayload
): Promise<AppealSubmissionResult> {
  try {
    const response = await client.post<AppealSubmissionResult>(
      '/moderation/appeals',
      payload
    );
    return response.data;
  } catch (error) {
    console.error('[AppealsAPI] Failed to submit appeal:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to submit appeal. Please try again.',
    };
  }
}

/**
 * Get appeal status
 *
 * Requirement: 4.2
 */
export async function apiGetAppealStatus(
  appealId: string
): Promise<Appeal | null> {
  try {
    const response = await client.get<Appeal>(
      `/moderation/appeals/${appealId}`
    );
    return response.data;
  } catch (error) {
    console.error('[AppealsAPI] Failed to fetch appeal status:', error);
    return null;
  }
}

/**
 * Get appeal with full context including original decision
 *
 * Requirement: 4.2
 */
export async function apiGetAppealContext(
  appealId: string
): Promise<AppealContextResponse | null> {
  try {
    const response = await client.get<AppealContextResponse>(
      `/moderation/appeals/${appealId}/context`
    );
    return response.data;
  } catch (error) {
    console.error('[AppealsAPI] Failed to fetch appeal context:', error);
    return null;
  }
}

// ============================================================================
// ODS Escalation
// ============================================================================

/**
 * Escalate appeal to ODS body
 *
 * Requirement: 4.8, 13.1
 */
export async function apiEscalateToODS(
  payload: ODSEscalationPayload
): Promise<ODSEscalationResponse> {
  try {
    const response = await client.post<ODSEscalationResponse>(
      '/moderation/appeals/ods-escalate',
      payload
    );
    return response.data;
  } catch (error) {
    console.error('[AppealsAPI] Failed to escalate to ODS:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to escalate to ODS. Please try again.',
    };
  }
}

/**
 * Get list of eligible ODS bodies
 *
 * Requirement: 13.1
 */
export async function apiGetODSBodies(filters?: {
  jurisdiction?: string;
  language?: string;
  appealType?: string;
}): Promise<
  {
    id: string;
    name: string;
    website: string;
    submissionUrl: string;
    languages: string[];
    jurisdictions: string[];
  }[]
> {
  try {
    const response = await client.get('/moderation/appeals/ods-bodies', {
      params: filters,
    });
    return response.data;
  } catch (error) {
    console.error('[AppealsAPI] Failed to fetch ODS bodies:', error);
    return [];
  }
}
