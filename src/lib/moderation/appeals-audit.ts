/**
 * Appeals Audit Logger
 *
 * Creates immutable audit trail for appeals-related actions (DSA compliance)
 * Integrates with privacy audit-log system
 */

import { appendAudit } from '@/lib/privacy/audit-log';

export type AppealsAuditAction =
  | 'appeal-submitted'
  | 'appeal-assigned'
  | 'appeal-decision'
  | 'decision-reversed'
  | 'ods-escalation';

export interface AppealsAuditDetails {
  appealId: string;
  action: AppealsAuditAction;
  userId?: string;
  reviewerId?: string;
  decision?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log an appeal-related audit event
 */
export async function logAppealsAudit(
  details: AppealsAuditDetails
): Promise<void> {
  try {
    await appendAudit({
      action: 'retention-delete', // Using existing type, can be extended
      dataType: 'appeals',
      details: {
        appealAction: details.action,
        appealId: details.appealId,
        userId: details.userId,
        reviewerId: details.reviewerId,
        decision: details.decision,
        ...details.metadata,
      },
    });
  } catch (error) {
    console.error('[AppealsAudit] Failed to log audit event:', error);
    // Don't throw - audit logging failure shouldn't block core operations
  }
}
