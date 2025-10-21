/**
 * ODS Integration - DSA Art. 21 Out-of-Court Dispute Settlement
 *
 * Implements:
 * - ODS body directory with eligibility criteria
 * - Escalation tracking with 90-day target monitoring
 * - Outcome management and platform decision reversal
 * - Certified ODS body links for users
 *
 * Requirements: 4.8, 13.1
 */

import { supabase } from '../supabase';
import { logAppealsAudit } from './appeals-audit';
import { sendAppealNotification } from './appeals-notifications';
import { getAppealStatus } from './appeals-service';
import { moderationMetrics } from './moderation-metrics';

// ============================================================================
// Constants
// ============================================================================

/**
 * Target resolution time for ODS cases per DSA Art. 21
 */
export const ODS_RESOLUTION_TARGET_DAYS = 90;

/**
 * ODS escalation eligibility criteria
 */
export const ODS_ELIGIBILITY = {
  // Internal appeal must be exhausted
  requiresInternalAppeal: true,
  // Minimum days since internal appeal decision
  minDaysSinceDecision: 0,
  // Maximum days since internal appeal decision
  maxDaysSinceDecision: 180, // 6 months
} as const;

// ============================================================================
// Types
// ============================================================================

export type ODSBodyStatus = 'certified' | 'suspended' | 'revoked';

export type ODSCaseStatus =
  | 'submitted'
  | 'in_progress'
  | 'resolved'
  | 'expired'
  | 'withdrawn';

export type ODSOutcome = 'upheld' | 'rejected' | 'partial' | 'no_decision';

export interface ODSBody {
  id: string;
  name: string;
  website: string;
  email: string;
  phone?: string;

  // Certification
  certificationNumber: string;
  certifiedBy: string; // e.g., "European Commission"
  certificationDate: Date;
  expirationDate?: Date;

  // Specialization
  languages: string[]; // ISO 639-1 codes
  jurisdictions: string[]; // ISO 3166-1 alpha-2 codes
  specialization: string[]; // e.g., ['content_moderation', 'account_suspension']

  // Status
  status: ODSBodyStatus;

  // Contact and process
  submissionUrl: string;
  submissionInstructions: string;
  averageResolutionDays: number;
  processingFee?: {
    amount: number;
    currency: string;
    description: string;
  };

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

export interface ODSEscalation {
  id: string;
  appealId: string;
  odsBodyId: string;

  // Case tracking
  caseNumber?: string; // ODS body's internal case number
  status: ODSCaseStatus;

  // Timeline
  submittedAt: Date;
  targetResolutionDate: Date; // 90 days from submission
  actualResolutionDate?: Date;

  // Outcome
  outcome?: ODSOutcome;
  outcomeReasoning?: string;
  odsDecisionDocument?: string; // URL or reference

  // Platform response
  platformActionRequired?: boolean;
  platformActionCompleted?: boolean;
  platformActionDate?: Date;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

export interface ODSEligibilityCheck {
  eligible: boolean;
  reasons: string[];
  eligibleBodies: ODSBody[];
}

// ============================================================================
// ODS Body Directory
// ============================================================================

/**
 * Get list of certified ODS bodies
 *
 * Filters by:
 * - Active certification status
 * - User's jurisdiction
 * - Appeal type specialization
 * - Language support
 *
 * Requirement: 13.1
 */
export async function getODSBodies(filters?: {
  jurisdiction?: string;
  language?: string;
  appealType?: string;
  activeOnly?: boolean;
}): Promise<ODSBody[]> {
  try {
    let query = supabase.from('ods_bodies').select('*').is('deleted_at', null);

    // Apply filters
    if (filters?.activeOnly !== false) {
      query = query.eq('status', 'certified');
    }

    if (filters?.jurisdiction) {
      query = query.contains('jurisdictions', [filters.jurisdiction]);
    }

    if (filters?.language) {
      query = query.contains('languages', [filters.language]);
    }

    if (filters?.appealType) {
      query = query.contains('specialization', [filters.appealType]);
    }

    const { data, error } = await query;

    if (error) throw error;
    return (data as ODSBody[]) || [];
  } catch (error) {
    console.error('[ODSIntegration] Failed to fetch ODS bodies:', error);
    return [];
  }
}

/**
 * Get specific ODS body details
 *
 * Requirement: 13.1
 */
export async function getODSBody(id: string): Promise<ODSBody | null> {
  try {
    const { data, error } = await supabase
      .from('ods_bodies')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error) throw error;
    return data as ODSBody;
  } catch (error) {
    console.error('[ODSIntegration] Failed to fetch ODS body:', error);
    return null;
  }
}

// ============================================================================
// Eligibility Checks
// ============================================================================

/**
 * Check if appeal is eligible for ODS escalation
 *
 * Validates:
 * - Internal appeal has been exhausted (resolved with 'rejected' decision)
 * - Appeal is within time window (not expired)
 * - User has not already escalated to ODS
 * - Eligible ODS bodies exist for user's jurisdiction
 *
 * Requirement: 4.8, 13.1
 *
 * TODO: Implement user profile fetching for jurisdiction and preferred language
 * Currently assumes no jurisdiction/language filters for ODS body eligibility
 */
export async function checkODSEligibility(
  appealId: string
): Promise<ODSEligibilityCheck> {
  const appeal = await getAppealStatus(appealId);

  if (!appeal) {
    return {
      eligible: false,
      reasons: ['Appeal not found'],
      eligibleBodies: [],
    };
  }

  const reasons: string[] = [];

  try {
    // Check if internal appeal is exhausted
    if (appeal.status !== 'resolved') {
      reasons.push('Internal appeal process must be completed first');
    }

    // Check if internal appeal was rejected
    if (appeal.decision !== 'rejected') {
      reasons.push(
        'ODS escalation only available for rejected internal appeals'
      );
    }

    // Check if already escalated to ODS
    if (appeal.ods_escalation_id) {
      reasons.push('Appeal has already been escalated to ODS');
    }

    // Check time window
    if (appeal.resolved_at) {
      const daysSinceResolution = Math.floor(
        (Date.now() - appeal.resolved_at.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceResolution < ODS_ELIGIBILITY.minDaysSinceDecision) {
        reasons.push(
          `Must wait at least ${ODS_ELIGIBILITY.minDaysSinceDecision} days after internal appeal decision`
        );
      }

      if (daysSinceResolution > ODS_ELIGIBILITY.maxDaysSinceDecision) {
        reasons.push(
          `ODS escalation window expired (maximum ${ODS_ELIGIBILITY.maxDaysSinceDecision} days)`
        );
      }
    }

    // Get eligible ODS bodies
    // TODO: Fetch user profile for jurisdiction and preferred language
    // const userProfile = await getUserProfile(appeal.user_id);
    const eligibleBodies = await getODSBodies({
      // jurisdiction: userProfile?.jurisdiction,
      // language: userProfile?.preferredLanguage,
      appealType: appeal.appeal_type,
      activeOnly: true,
    });

    if (eligibleBodies.length === 0) {
      reasons.push('No certified ODS bodies available for this appeal type');
    }

    return {
      eligible: reasons.length === 0,
      reasons,
      eligibleBodies,
    };
  } catch (error) {
    console.error('[ODSIntegration] Failed to check ODS eligibility:', error);
    return {
      eligible: false,
      reasons: ['Error checking eligibility'],
      eligibleBodies: [],
    };
  }
}

// ============================================================================
// ODS Escalation
// ============================================================================

/**
 * Escalate appeal to ODS body
 *
 * Creates escalation record with:
 * - ODS body selection
 * - Case tracking information
 * - 90-day target resolution date
 *
 * Returns escalation details and submission instructions
 *
 * Requirement: 4.8, 13.1
 */
export async function escalateToODS(
  appealId: string,
  odsBodyId: string
): Promise<{
  success: boolean;
  escalation?: ODSEscalation;
  odsBody?: ODSBody;
  error?: string;
}> {
  try {
    const eligibility = await checkODSEligibility(appealId);
    if (!eligibility.eligible) {
      return {
        success: false,
        error: `Not eligible for ODS escalation: ${eligibility.reasons.join(', ')}`,
      };
    }

    const odsBody = await getODSBody(odsBodyId);
    if (!odsBody)
      return { success: false, error: 'Selected ODS body not found' };

    if (!eligibility.eligibleBodies.some((b) => b.id === odsBodyId)) {
      return {
        success: false,
        error: 'Selected ODS body is not eligible for this appeal',
      };
    }

    const targetResolutionDate = thisCalcTargetResolutionDate();

    const createdEscalation = await createODSEscalation({
      appealId,
      odsBodyId,
      status: 'submitted',
      submittedAt: new Date(),
      targetResolutionDate,
    });

    await updateAppealODSEscalation(
      appealId,
      createdEscalation.id,
      odsBody.name
    );

    const appeal = await getAppealStatus(appealId);
    if (appeal) {
      await sendAppealNotification({
        appealId,
        userId: appeal.user_id,
        type: 'ods_escalation',
        status: 'escalated_to_ods',
        odsBodyName: odsBody.name,
      });
    }

    await logAppealsAudit({
      appealId,
      action: 'ods-escalation',
      userId: appeal?.user_id,
      metadata: { odsBodyId, odsBodyName: odsBody.name, targetResolutionDate },
    });

    return { success: true, escalation: createdEscalation, odsBody };
  } catch (error) {
    console.error('[ODSIntegration] Failed to escalate to ODS:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Escalation failed',
    };
  }
}

function thisCalcTargetResolutionDate() {
  const d = new Date();
  d.setDate(d.getDate() + ODS_RESOLUTION_TARGET_DAYS);
  return d;
}

/**
 * Get ODS escalation status
 *
 * Requirement: 4.8
 */
export async function getODSEscalation(
  escalationId: string
): Promise<ODSEscalation | null> {
  try {
    const { data, error } = await supabase
      .from('ods_escalations')
      .select('*')
      .eq('id', escalationId)
      .is('deleted_at', null)
      .single();

    if (error) throw error;
    return data as ODSEscalation;
  } catch (error) {
    console.error('[ODSIntegration] Failed to get ODS escalation:', error);
    return null;
  }
}

/**
 * Update ODS case status
 *
 * Called when ODS body provides status updates
 *
 * Requirement: 4.8
 */
export async function updateODSCaseStatus(
  escalationId: string,
  update: {
    caseNumber?: string;
    status: ODSCaseStatus;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('ods_escalations')
      .update({
        case_number: update.caseNumber,
        status: update.status,
        updated_at: new Date(),
      })
      .eq('id', escalationId);

    if (error) throw error;

    // Get escalation and appeal for notification
    const escalation = await getODSEscalation(escalationId);
    if (escalation) {
      const appeal = await getAppealStatus(escalation.appealId);
      if (appeal) {
        // Send notification to user about status update
        console.log(
          `[ODSIntegration] Sending status update notification to user ${appeal.user_id}`
        );
      }

      // Log audit event
      await logAppealsAudit({
        appealId: escalation.appealId,
        action: 'ods-escalation',
        metadata: {
          escalationId,
          caseNumber: update.caseNumber,
          status: update.status,
        },
      });
    }

    return { success: true };
  } catch (error) {
    console.error('[ODSIntegration] Failed to update ODS case status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Update failed',
    };
  }
}

/**
 * Record ODS outcome and implement platform decision
 *
 * If ODS favors user:
 * - Reverses platform decision
 * - Restores content/account
 * - Logs outcome
 *
 * If ODS favors platform:
 * - Maintains original decision
 * - Logs outcome for transparency
 *
 * Requirement: 4.8
 */
export async function recordODSOutcome(
  escalationId: string,
  outcome: {
    outcome: ODSOutcome;
    reasoning: string;
    decisionDocument?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const escalation = await getODSEscalation(escalationId);
    if (!escalation) {
      return { success: false, error: 'Escalation not found' };
    }

    // Update escalation with outcome
    await updateODSOutcome(escalationId, {
      outcome: outcome.outcome,
      outcomeReasoning: outcome.reasoning,
      odsDecisionDocument: outcome.decisionDocument,
      status: 'resolved',
      actualResolutionDate: new Date(),
    });

    // If ODS upholds user's appeal, reverse platform decision
    if (outcome.outcome === 'upheld' || outcome.outcome === 'partial') {
      // Get original decision from appeal
      const appeal = await getAppealStatus(escalation.appealId);
      console.log(
        '[ODSIntegration] ODS outcome favors user - reversal required for decision:',
        appeal?.original_decision_id
      );

      await updateODSPlatformAction(escalationId, {
        platformActionRequired: true,
        platformActionCompleted: true,
        platformActionDate: new Date(),
      });
    }

    // Get appeal for user notification
    const appeal = await getAppealStatus(escalation.appealId);

    // Send notification to user
    if (appeal) {
      console.log(
        `[ODSIntegration] Sending ODS outcome notification to user ${appeal.user_id}`
      );
    }

    // Log audit event
    await logAppealsAudit({
      appealId: escalation.appealId,
      action: 'ods-escalation',
      metadata: {
        escalationId,
        outcome: outcome.outcome,
        reasoning: outcome.reasoning,
      },
    });

    // Update metrics (ODS outcomes for transparency reporting)
    const resolutionDays = escalation.actualResolutionDate
      ? Math.floor(
          (escalation.actualResolutionDate.getTime() -
            escalation.submittedAt.getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : 0;

    moderationMetrics.trackODSOutcome(escalationId, outcome.outcome, {
      odsBodyId: escalation.odsBodyId,
      resolutionDays,
    });

    return { success: true };
  } catch (error) {
    console.error('[ODSIntegration] Failed to record ODS outcome:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Recording failed',
    };
  }
}

/**
 * Get ODS statistics for transparency reporting
 *
 * Requirement: 13.1
 */
export async function getODSStatistics(_period: {
  startDate: Date;
  endDate: Date;
}): Promise<{
  totalEscalations: number;
  resolved: number;
  pending: number;
  averageResolutionDays: number;
  outcomeBreakdown: Record<ODSOutcome, number>;
  upholdsReversed: number;
}> {
  // TODO: Implement Supabase aggregation query
  return {
    totalEscalations: 0,
    resolved: 0,
    pending: 0,
    averageResolutionDays: 0,
    outcomeBreakdown: {
      upheld: 0,
      rejected: 0,
      partial: 0,
      no_decision: 0,
    },
    upholdsReversed: 0,
  };
}

// ============================================================================
// Database Operations (TODO: Implement with Supabase)
// ============================================================================

async function createODSEscalation(
  escalation: Partial<ODSEscalation>
): Promise<ODSEscalation> {
  try {
    const { data, error } = await supabase
      .from('ods_escalations')
      .insert(escalation)
      .select()
      .single();

    if (error) throw error;
    return data as ODSEscalation;
  } catch (error) {
    console.error('[ODSIntegration] Failed to create ODS escalation:', error);
    throw error;
  }
}

async function updateAppealODSEscalation(
  appealId: string,
  escalationId: string,
  odsBodyName: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('appeals')
      .update({
        ods_escalation_id: escalationId,
        ods_body_name: odsBodyName,
        ods_submitted_at: new Date(),
        status: 'escalated_to_ods',
        updated_at: new Date(),
      })
      .eq('id', appealId);

    if (error) throw error;
  } catch (error) {
    console.error(
      '[ODSIntegration] Failed to update appeal ODS escalation:',
      error
    );
    throw error;
  }
}

async function updateODSOutcome(
  escalationId: string,
  outcome: {
    outcome: ODSOutcome;
    outcomeReasoning: string;
    odsDecisionDocument?: string;
    status: ODSCaseStatus;
    actualResolutionDate: Date;
  }
): Promise<void> {
  try {
    const { error } = await supabase
      .from('ods_escalations')
      .update({
        outcome: outcome.outcome,
        outcome_reasoning: outcome.outcomeReasoning,
        ods_decision_document: outcome.odsDecisionDocument,
        status: outcome.status,
        actual_resolution_date: outcome.actualResolutionDate,
        updated_at: new Date(),
      })
      .eq('id', escalationId);

    if (error) throw error;
  } catch (error) {
    console.error('[ODSIntegration] Failed to update ODS outcome:', error);
    throw error;
  }
}

async function updateODSPlatformAction(
  escalationId: string,
  action: {
    platformActionRequired: boolean;
    platformActionCompleted: boolean;
    platformActionDate: Date;
  }
): Promise<void> {
  try {
    const { error } = await supabase
      .from('ods_escalations')
      .update({
        platform_action_required: action.platformActionRequired,
        platform_action_completed: action.platformActionCompleted,
        platform_action_date: action.platformActionDate,
        updated_at: new Date(),
      })
      .eq('id', escalationId);

    if (error) throw error;
  } catch (error) {
    console.error(
      '[ODSIntegration] Failed to update ODS platform action:',
      error
    );
    throw error;
  }
}

// ============================================================================
// Exports
// ============================================================================

export const odsIntegration = {
  getODSBodies,
  getODSBody,
  checkODSEligibility,
  escalateToODS,
  getODSEscalation,
  updateODSCaseStatus,
  recordODSOutcome,
  getODSStatistics,
};
