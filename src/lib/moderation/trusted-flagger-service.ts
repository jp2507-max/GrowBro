/**
 * Trusted Flagger Service
 * Implements DSA Art. 22 Trusted Flagger management with registration,
 * certification, and status management
 *
 * Requirements: 11.1, 11.2, 11.3
 */

import { supabase } from '@/lib/supabase';
import type {
  QualityMetrics,
  RegisterFlaggerInput,
  TrustedFlagger,
  TrustedFlaggerStatus,
} from '@/types/moderation';

import { AuditService } from './audit-service';

// Initialize audit service
const auditService = new AuditService(supabase);

// ============================================================================
// Types
// ============================================================================

export interface CertifyFlaggerInput {
  flaggerId: string;
  certifiedBy: string; // Moderator/admin ID
  reviewNotes?: string;
}

export interface UpdateStatusInput {
  flaggerId: string;
  status: TrustedFlaggerStatus;
  reason: string;
  updatedBy: string;
}

export interface FlaggerListFilters {
  status?: TrustedFlaggerStatus;
  specializationContains?: string;
  reviewDueBefore?: Date;
}

// ============================================================================
// Service Functions
// ============================================================================

/**
 * Register a new trusted flagger application
 * Creates pending entry for admin review
 */
export async function registerFlagger(
  input: RegisterFlaggerInput
): Promise<{ flaggerId: string }> {
  // Validate input
  if (!input.user_id?.trim()) {
    throw new Error('User ID is required');
  }

  if (!input.organizationName?.trim()) {
    throw new Error('Organization name is required');
  }

  if (!input.contactInfo?.email?.trim()) {
    throw new Error('Contact email is required');
  }

  if (!input.specialization || input.specialization.length === 0) {
    throw new Error('At least one specialization is required');
  }

  // Set initial review date to 6 months from now
  const reviewDate = new Date();
  reviewDate.setMonth(reviewDate.getMonth() + 6);

  const { data, error } = await supabase
    .from('trusted_flaggers')
    .insert({
      user_id: input.user_id,
      organization_name: input.organizationName,
      contact_info: input.contactInfo,
      specialization: input.specialization,
      status: 'suspended', // Start as suspended until certified
      quality_metrics: {
        accuracy_rate: null,
        average_handling_time_hours: null,
        total_reports: 0,
        upheld_decisions: 0,
      },
      certification_date: null,
      review_date: reviewDate.toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to register trusted flagger: ${error.message}`);
  }

  // Log registration event
  await auditService.logEvent({
    event_type: 'trusted_flagger_registered',
    actor_id: input.user_id,
    actor_type: 'user',
    target_id: data.id,
    target_type: 'trusted_flagger',
    action: 'register',
    metadata: {
      organizationName: input.organizationName,
      specialization: input.specialization,
    },
  });

  return { flaggerId: data.id };
}

/**
 * Certify a trusted flagger after review
 * Activates flagger and sets certification date
 */
export async function certifyFlagger(
  input: CertifyFlaggerInput
): Promise<void> {
  const certificationDate = new Date();
  const reviewDate = new Date();
  reviewDate.setMonth(reviewDate.getMonth() + 6);

  const { error } = await supabase
    .from('trusted_flaggers')
    .update({
      status: 'active',
      certification_date: certificationDate.toISOString(),
      review_date: reviewDate.toISOString(),
    })
    .eq('id', input.flaggerId);

  if (error) {
    throw new Error(`Failed to certify trusted flagger: ${error.message}`);
  }

  // Log certification event
  await auditService.logEvent({
    event_type: 'trusted_flagger_certified',
    actor_id: input.certifiedBy,
    actor_type: 'moderator',
    target_id: input.flaggerId,
    target_type: 'trusted_flagger',
    action: 'certify',
    metadata: {
      certificationDate: certificationDate.toISOString(),
      reviewDate: reviewDate.toISOString(),
      notes: input.reviewNotes,
    },
  });
}

/**
 * Update trusted flagger status
 * Supports suspension and revocation with audit trail
 */
export async function updateFlaggerStatus(
  input: UpdateStatusInput
): Promise<void> {
  if (!input.reason?.trim()) {
    throw new Error('Reason is required for status update');
  }

  const { error } = await supabase
    .from('trusted_flaggers')
    .update({
      status: input.status,
    })
    .eq('id', input.flaggerId);

  if (error) {
    throw new Error(`Failed to update flagger status: ${error.message}`);
  }

  // Log status change
  await auditService.logEvent({
    event_type: 'trusted_flagger_status_updated',
    actor_id: input.updatedBy,
    actor_type: 'moderator',
    target_id: input.flaggerId,
    target_type: 'trusted_flagger',
    action: 'update_status',
    metadata: {
      newStatus: input.status,
      reason: input.reason,
    },
  });
}

/**
 * Get trusted flagger by ID
 */
export async function getFlaggerById(
  flaggerId: string
): Promise<TrustedFlagger | null> {
  const { data, error } = await supabase
    .from('trusted_flaggers')
    .select('*')
    .eq('id', flaggerId)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Not found
      return null;
    }
    throw new Error(`Failed to fetch trusted flagger: ${error.message}`);
  }

  return mapDatabaseRowToFlagger(data);
}

/**
 * List trusted flaggers with filters
 */
export async function listFlaggers(
  filters?: FlaggerListFilters
): Promise<TrustedFlagger[]> {
  let query = supabase
    .from('trusted_flaggers')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.specializationContains) {
    query = query.contains('specialization', [filters.specializationContains]);
  }

  if (filters?.reviewDueBefore) {
    query = query.lte('review_date', filters.reviewDueBefore.toISOString());
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list trusted flaggers: ${error.message}`);
  }

  return (data || []).map(mapDatabaseRowToFlagger);
}

/**
 * Get flaggers that need periodic review
 */
export async function getFlaggersDueForReview(): Promise<TrustedFlagger[]> {
  const now = new Date();

  return listFlaggers({
    status: 'active',
    reviewDueBefore: now,
  });
}

/**
 * Update quality metrics for a flagger
 * Called after moderation decisions are made
 */
export async function updateFlaggerMetrics(
  flaggerId: string,
  metrics: Partial<QualityMetrics>
): Promise<void> {
  // Fetch current metrics
  const { data: current, error: fetchError } = await supabase
    .from('trusted_flaggers')
    .select('quality_metrics')
    .eq('id', flaggerId)
    .single();

  if (fetchError) {
    throw new Error(`Failed to fetch current metrics: ${fetchError.message}`);
  }

  // Merge with new metrics
  const updatedMetrics: QualityMetrics = {
    ...current.quality_metrics,
    ...metrics,
  };

  const { error } = await supabase
    .from('trusted_flaggers')
    .update({
      quality_metrics: updatedMetrics,
    })
    .eq('id', flaggerId);

  if (error) {
    throw new Error(`Failed to update flagger metrics: ${error.message}`);
  }
}

/**
 * Check if user is a trusted flagger
 */
export async function isUserTrustedFlagger(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('trusted_flaggers')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return false;
    }
    throw new Error(`Failed to check trusted flagger status: ${error.message}`);
  }

  return !!data;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map database row to TrustedFlagger type
 */
function mapDatabaseRowToFlagger(row: any): TrustedFlagger {
  return {
    id: row.id,
    user_id: row.user_id,
    organization_name: row.organization_name,
    contact_info: row.contact_info,
    specialization: row.specialization,
    status: row.status,
    quality_metrics: row.quality_metrics,
    certification_date: row.certification_date
      ? new Date(row.certification_date)
      : null,
    review_date: new Date(row.review_date),
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
    deleted_at: row.deleted_at ? new Date(row.deleted_at) : undefined,
  };
}
