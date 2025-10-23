/**
 * Repeat Offender Service - DSA Art. 23 Graduated Enforcement
 *
 * Manages violation tracking, escalation logic, and graduated enforcement
 * for repeat offenders and manifestly unfounded reporters.
 *
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7
 */

import { DateTime } from 'luxon';

import type {
  EscalationLevel,
  OffenderStatus,
  RepeatOffenderRecord,
  SuspensionRecord,
} from '@/types/moderation';

import { supabase } from '../supabase';
import { AuditService } from './audit-service';
import {
  calculateEscalationLevel,
  calculateSuspensionDuration,
  getManifestlyUnfoundedAction,
  requiresImmediateBan,
} from './enforcement-config';

// ============================================================================
// Types
// ============================================================================

export interface RecordViolationInput {
  user_id: string;
  violation_type: string;
  decision_id: string;
  reasoning: string;
}

export interface RecordViolationResult {
  success: boolean;
  record?: RepeatOffenderRecord;
  escalation_occurred?: boolean;
  new_escalation_level?: EscalationLevel;
  suspension_applied?: SuspensionRecord;
  error?: string;
}

export interface TrackManifestlyUnfoundedInput {
  reporter_id: string;
  report_id: string;
  decision_id: string;
  reasoning: string;
}

export interface TrackManifestlyUnfoundedResult {
  success: boolean;
  record?: RepeatOffenderRecord;
  action_taken?: 'none' | 'warning' | 'temporary_suspension' | 'permanent_ban';
  error?: string;
}

export interface CorrectViolationInput {
  user_id: string;
  violation_type: string;
  reason: string;
  moderator_id: string;
  reduce_count_by?: number;
  new_escalation_level?: EscalationLevel;
}

export interface CorrectViolationResult {
  success: boolean;
  record?: RepeatOffenderRecord;
  previous_state?: Partial<RepeatOffenderRecord>;
  error?: string;
}

export interface RepeatOffenderStatistics {
  total_records: number;
  by_escalation_level: Record<EscalationLevel, number>;
  by_status: Record<OffenderStatus, number>;
  by_violation_type: Record<string, number>;
  manifestly_unfounded_count: number;
  total_suspensions: number;
  permanent_bans: number;
  active_suspensions: number;
}

// ============================================================================
// Repeat Offender Service
// ============================================================================

export class RepeatOffenderService {
  private auditService: AuditService;

  constructor() {
    this.auditService = new AuditService(supabase);
  }

  /**
   * Record a violation and apply graduated enforcement
   */
  async recordViolation(
    input: RecordViolationInput
  ): Promise<RecordViolationResult> {
    try {
      if (requiresImmediateBan(input.violation_type)) {
        return await this.applyImmediateBan(input);
      }

      const record = await this.getOrCreateRecord(
        input.user_id,
        input.violation_type
      );

      const newViolationCount = record.violation_count + 1;
      const newEscalationLevel = calculateEscalationLevel(
        newViolationCount,
        input.violation_type
      );
      const escalationOccurred = newEscalationLevel !== record.escalation_level;

      const { suspensionApplied, newStatus } = await this.handleEscalation({
        escalationOccurred,
        input,
        newEscalationLevel,
        record,
      });

      const updatedRecord = await this.updateViolationRecord({
        record,
        newViolationCount,
        newEscalationLevel,
        suspensionApplied,
        newStatus,
      });

      await this.logViolationAudit({
        record,
        input,
        newViolationCount,
        newEscalationLevel,
        escalationOccurred,
        suspensionApplied,
      });

      return {
        success: true,
        record: this.parseRecord(updatedRecord),
        escalation_occurred: escalationOccurred,
        new_escalation_level: newEscalationLevel,
        suspension_applied: suspensionApplied,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  private async handleEscalation(params: {
    escalationOccurred: boolean;
    input: RecordViolationInput;
    newEscalationLevel: EscalationLevel;
    record: RepeatOffenderRecord;
  }): Promise<{ suspensionApplied?: SuspensionRecord; newStatus: string }> {
    const { escalationOccurred, input, newEscalationLevel, record } = params;
    if (!escalationOccurred) {
      return { newStatus: record.status };
    }

    const enforcementResult = await this.applyEnforcement({
      userId: input.user_id,
      violationType: input.violation_type,
      escalationLevel: newEscalationLevel,
      suspensionCount: record.suspension_history.length,
    });

    return {
      suspensionApplied: enforcementResult.suspension,
      newStatus: enforcementResult.status,
    };
  }

  private async updateViolationRecord(params: {
    record: RepeatOffenderRecord;
    newViolationCount: number;
    newEscalationLevel: EscalationLevel;
    suspensionApplied?: SuspensionRecord;
    newStatus: string;
  }): Promise<any> {
    const {
      record,
      newViolationCount,
      newEscalationLevel,
      suspensionApplied,
      newStatus,
    } = params;
    const suspensionHistory = suspensionApplied
      ? [...record.suspension_history, suspensionApplied]
      : record.suspension_history;

    const { data, error } = await supabase
      .from('repeat_offender_records')
      .update({
        violation_count: newViolationCount,
        escalation_level: newEscalationLevel,
        last_violation_date: new Date().toISOString(),
        suspension_history: suspensionHistory,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', record.id)
      .select()
      .single();

    if (error) {
      throw new Error(
        `Failed to update repeat offender record: ${error.message}`
      );
    }

    return data;
  }

  private async logViolationAudit(params: {
    record: RepeatOffenderRecord;
    input: RecordViolationInput;
    newViolationCount: number;
    newEscalationLevel: EscalationLevel;
    escalationOccurred: boolean;
    suspensionApplied?: SuspensionRecord;
  }): Promise<void> {
    const {
      record,
      input,
      newViolationCount,
      newEscalationLevel,
      escalationOccurred,
      suspensionApplied,
    } = params;
    await this.auditService.logEvent({
      event_type: 'repeat_offender_violation_recorded',
      actor_id: 'system',
      actor_type: 'system',
      target_id: record.id,
      target_type: 'repeat_offender_record',
      action: escalationOccurred ? 'escalation_applied' : 'violation_recorded',
      metadata: {
        user_id: input.user_id,
        violation_type: input.violation_type,
        decision_id: input.decision_id,
        reasoning: input.reasoning,
        violation_count: newViolationCount,
        escalation_level: newEscalationLevel,
        escalation_occurred: escalationOccurred,
        suspension_applied: suspensionApplied,
      },
    });
  }

  /**
   * Get repeat offender record for a user and violation type
   *
   * Requirements: 12.5
   */
  async getRecord(
    userId: string,
    violationType: string
  ): Promise<RepeatOffenderRecord | null> {
    const { data, error } = await supabase
      .from('repeat_offender_records')
      .select('*')
      .eq('user_id', userId)
      .eq('violation_type', violationType)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Failed to fetch repeat offender record: ${error.message}`
      );
    }

    return data ? this.parseRecord(data) : null;
  }

  /**
   * Get all repeat offender records for a user
   *
   * Requirements: 12.5
   */
  async getAllRecordsForUser(userId: string): Promise<RepeatOffenderRecord[]> {
    const { data, error } = await supabase
      .from('repeat_offender_records')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('violation_count', { ascending: false });

    if (error) {
      throw new Error(
        `Failed to fetch repeat offender records: ${error.message}`
      );
    }

    return data ? data.map(this.parseRecord) : [];
  }

  /**
   * Track manifestly unfounded report (DSA Art. 23 misuse tracking)
   */
  async trackManifestlyUnfounded(
    input: TrackManifestlyUnfoundedInput
  ): Promise<TrackManifestlyUnfoundedResult> {
    try {
      const record = await this.getOrCreateRecord(
        input.reporter_id,
        'manifestly_unfounded_report'
      );

      const newCount = record.manifestly_unfounded_reports + 1;
      const action = getManifestlyUnfoundedAction(newCount);

      const { newStatus, newEscalationLevel, suspensionHistory } =
        this.applyManifestlyUnfoundedAction(action, newCount, record);

      const updatedRecord = await this.updateManifestlyUnfoundedRecord({
        record,
        newCount,
        newEscalationLevel,
        newStatus,
        suspensionHistory,
      });

      await this.logManifestlyUnfoundedAudit({
        record,
        input,
        newCount,
        action,
      });

      return {
        success: true,
        record: this.parseRecord(updatedRecord),
        action_taken: action,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  private applyManifestlyUnfoundedAction(
    action: string,
    newCount: number,
    record: RepeatOffenderRecord
  ): {
    newStatus: string;
    newEscalationLevel: EscalationLevel;
    suspensionHistory: SuspensionRecord[];
  } {
    let newStatus = record.status;
    let newEscalationLevel = record.escalation_level;
    const suspensionHistory = [...record.suspension_history];

    if (action === 'temporary_suspension' && newStatus !== 'suspended') {
      newStatus = 'suspended';
      newEscalationLevel = 'temporary_suspension';
      const suspensionDuration = 7;
      suspensionHistory.push({
        start: new Date(),
        end: DateTime.now().plus({ days: suspensionDuration }).toJSDate(),
        reason: `Manifestly unfounded reports (${newCount} reports)`,
        duration_days: suspensionDuration,
      });
    } else if (action === 'permanent_ban' && newStatus !== 'banned') {
      newStatus = 'banned';
      newEscalationLevel = 'permanent_ban';
      suspensionHistory.push({
        start: new Date(),
        reason: `Persistent manifestly unfounded reports (${newCount} reports)`,
      });
    }

    return { newStatus, newEscalationLevel, suspensionHistory };
  }

  private async updateManifestlyUnfoundedRecord(params: {
    record: RepeatOffenderRecord;
    newCount: number;
    newEscalationLevel: EscalationLevel;
    newStatus: string;
    suspensionHistory: SuspensionRecord[];
  }): Promise<any> {
    const {
      record,
      newCount,
      newEscalationLevel,
      newStatus,
      suspensionHistory,
    } = params;
    const { data, error } = await supabase
      .from('repeat_offender_records')
      .update({
        manifestly_unfounded_reports: newCount,
        escalation_level: newEscalationLevel,
        status: newStatus,
        suspension_history: suspensionHistory,
        updated_at: new Date().toISOString(),
      })
      .eq('id', record.id)
      .select()
      .single();

    if (error) {
      throw new Error(
        `Failed to update manifestly unfounded record: ${error.message}`
      );
    }

    return data;
  }

  private async logManifestlyUnfoundedAudit(params: {
    record: RepeatOffenderRecord;
    input: TrackManifestlyUnfoundedInput;
    newCount: number;
    action: string;
  }): Promise<void> {
    const { record, input, newCount, action } = params;
    await this.auditService.logEvent({
      event_type: 'manifestly_unfounded_report_tracked',
      actor_id: 'system',
      actor_type: 'system',
      target_id: record.id,
      target_type: 'repeat_offender_record',
      action: action !== 'none' ? action : 'tracked',
      metadata: {
        reporter_id: input.reporter_id,
        report_id: input.report_id,
        decision_id: input.decision_id,
        reasoning: input.reasoning,
        manifestly_unfounded_count: newCount,
        action_taken: action,
      },
    });
  }

  /**
   * Correct false positive violation
   *
   * Requirements: 12.6
   */
  async correctViolation(
    input: CorrectViolationInput
  ): Promise<CorrectViolationResult> {
    try {
      const record = await this.getRecord(input.user_id, input.violation_type);

      if (!record) {
        return {
          success: false,
          error: 'Repeat offender record not found',
        };
      }

      // Store previous state for audit
      const previousState = {
        violation_count: record.violation_count,
        escalation_level: record.escalation_level,
        status: record.status,
      };

      // Calculate new values
      const reduceBy = input.reduce_count_by || 1;
      const newViolationCount = Math.max(0, record.violation_count - reduceBy);

      // Determine new escalation level
      const newEscalationLevel =
        input.new_escalation_level ||
        calculateEscalationLevel(newViolationCount, input.violation_type);

      // Determine new status (don't auto-reinstate if banned)
      let newStatus = record.status;
      if (newEscalationLevel === 'warning' && record.status === 'suspended') {
        newStatus = 'active';
      }

      // Update record
      const { data: updatedRecord, error } = await supabase
        .from('repeat_offender_records')
        .update({
          violation_count: newViolationCount,
          escalation_level: newEscalationLevel,
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', record.id)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to correct violation: ${error.message}`);
      }

      // Log audit event
      await this.auditService.logEvent({
        event_type: 'repeat_offender_violation_corrected',
        actor_id: input.moderator_id,
        actor_type: 'moderator',
        target_id: record.id,
        target_type: 'repeat_offender_record',
        action: 'correction_applied',
        metadata: {
          user_id: input.user_id,
          violation_type: input.violation_type,
          reason: input.reason,
          previous_state: previousState,
          new_state: {
            violation_count: newViolationCount,
            escalation_level: newEscalationLevel,
            status: newStatus,
          },
        },
      });

      return {
        success: true,
        record: this.parseRecord(updatedRecord),
        previous_state: previousState,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Get repeat offender statistics for transparency reporting
   *
   * Requirements: 12.7
   */
  async getStatistics(): Promise<RepeatOffenderStatistics> {
    const { data: records, error } = await supabase
      .from('repeat_offender_records')
      .select('*')
      .is('deleted_at', null);

    if (error) {
      throw new Error(`Failed to fetch statistics: ${error.message}`);
    }

    if (!records || records.length === 0) {
      return this.getEmptyStatistics();
    }

    const stats: RepeatOffenderStatistics = {
      total_records: records.length,
      by_escalation_level: {
        warning: 0,
        temporary_suspension: 0,
        permanent_ban: 0,
      },
      by_status: {
        active: 0,
        suspended: 0,
        banned: 0,
      },
      by_violation_type: {},
      manifestly_unfounded_count: 0,
      total_suspensions: 0,
      permanent_bans: 0,
      active_suspensions: 0,
    };

    const now = DateTime.now();

    for (const record of records) {
      // Escalation level
      stats.by_escalation_level[record.escalation_level as EscalationLevel]++;

      // Status
      stats.by_status[record.status as OffenderStatus]++;

      // Violation type
      stats.by_violation_type[record.violation_type] =
        (stats.by_violation_type[record.violation_type] || 0) + 1;

      // Manifestly unfounded
      if (record.manifestly_unfounded_reports > 0) {
        stats.manifestly_unfounded_count++;
      }

      // Suspensions
      if (
        record.suspension_history &&
        Array.isArray(record.suspension_history)
      ) {
        stats.total_suspensions += record.suspension_history.length;

        // Check for active suspensions
        for (const suspension of record.suspension_history) {
          if (!suspension.end) {
            // Permanent ban
            stats.permanent_bans++;
          } else {
            const endDate = DateTime.fromISO(suspension.end);
            if (endDate > now) {
              stats.active_suspensions++;
            }
          }
        }
      }
    }

    return stats;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Get or create repeat offender record
   */
  private async getOrCreateRecord(
    userId: string,
    violationType: string
  ): Promise<RepeatOffenderRecord> {
    // Try to get existing record
    const existing = await this.getRecord(userId, violationType);
    if (existing) {
      return existing;
    }

    // Create new record
    const { data, error } = await supabase
      .from('repeat_offender_records')
      .insert({
        user_id: userId,
        violation_type: violationType,
        violation_count: 0,
        escalation_level: 'warning',
        status: 'active',
        manifestly_unfounded_reports: 0,
        suspension_history: [],
      })
      .select()
      .single();

    if (error) {
      throw new Error(
        `Failed to create repeat offender record: ${error.message}`
      );
    }

    return this.parseRecord(data);
  }

  /**
   * Apply enforcement action based on escalation level
   */
  private async applyEnforcement(params: {
    userId: string;
    violationType: string;
    escalationLevel: EscalationLevel;
    suspensionCount: number;
  }): Promise<{
    suspension?: SuspensionRecord;
    status: OffenderStatus;
  }> {
    const { violationType, escalationLevel, suspensionCount } = params;
    if (escalationLevel === 'warning') {
      return { status: 'active' };
    }

    if (escalationLevel === 'temporary_suspension') {
      const durationDays = calculateSuspensionDuration(
        suspensionCount,
        violationType
      );

      if (durationDays === null) {
        // Permanent ban
        return {
          suspension: {
            start: new Date(),
            reason: `Repeat violations of ${violationType} policy`,
          },
          status: 'banned',
        };
      }

      // Temporary suspension
      const endDate = DateTime.now().plus({ days: durationDays }).toJSDate();

      return {
        suspension: {
          start: new Date(),
          end: endDate,
          reason: `Repeat violations of ${violationType} policy`,
          duration_days: durationDays,
        },
        status: 'suspended',
      };
    }

    // Permanent ban
    return {
      suspension: {
        start: new Date(),
        reason: `Persistent violations of ${violationType} policy`,
      },
      status: 'banned',
    };
  }

  /**
   * Apply immediate permanent ban for critical violations
   */
  private async applyImmediateBan(
    input: RecordViolationInput
  ): Promise<RecordViolationResult> {
    // Get or create record
    const record = await this.getOrCreateRecord(
      input.user_id,
      input.violation_type
    );

    const suspensionRecord: SuspensionRecord = {
      start: new Date(),
      reason: `Critical violation: ${input.violation_type}`,
    };

    const { data: updatedRecord, error } = await supabase
      .from('repeat_offender_records')
      .update({
        violation_count: record.violation_count + 1,
        escalation_level: 'permanent_ban',
        last_violation_date: new Date().toISOString(),
        suspension_history: [...record.suspension_history, suspensionRecord],
        status: 'banned',
        updated_at: new Date().toISOString(),
      })
      .eq('id', record.id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to apply immediate ban: ${error.message}`);
    }

    // Log audit event
    await this.auditService.logEvent({
      event_type: 'repeat_offender_immediate_ban',
      actor_id: 'system',
      actor_type: 'system',
      target_id: record.id,
      target_type: 'repeat_offender_record',
      action: 'permanent_ban_applied',
      metadata: {
        user_id: input.user_id,
        violation_type: input.violation_type,
        decision_id: input.decision_id,
        reasoning: input.reasoning,
      },
    });

    return {
      success: true,
      record: this.parseRecord(updatedRecord),
      escalation_occurred: true,
      new_escalation_level: 'permanent_ban',
      suspension_applied: suspensionRecord,
    };
  }

  /**
   * Parse database record to TypeScript type
   */
  private parseRecord(data: any): RepeatOffenderRecord {
    return {
      id: data.id,
      user_id: data.user_id,
      violation_type: data.violation_type,
      violation_count: data.violation_count,
      escalation_level: data.escalation_level,
      last_violation_date: data.last_violation_date
        ? new Date(data.last_violation_date)
        : undefined,
      suspension_history: Array.isArray(data.suspension_history)
        ? data.suspension_history.map((s: any) => ({
            start: new Date(s.start),
            end: s.end ? new Date(s.end) : undefined,
            reason: s.reason,
            duration_days: s.duration_days,
          }))
        : [],
      manifestly_unfounded_reports: data.manifestly_unfounded_reports || 0,
      status: data.status,
      created_at: new Date(data.created_at),
      updated_at: new Date(data.updated_at),
      deleted_at: data.deleted_at ? new Date(data.deleted_at) : undefined,
    };
  }

  /**
   * Get empty statistics structure
   */
  private getEmptyStatistics(): RepeatOffenderStatistics {
    return {
      total_records: 0,
      by_escalation_level: {
        warning: 0,
        temporary_suspension: 0,
        permanent_ban: 0,
      },
      by_status: {
        active: 0,
        suspended: 0,
        banned: 0,
      },
      by_violation_type: {},
      manifestly_unfounded_count: 0,
      total_suspensions: 0,
      permanent_bans: 0,
      active_suspensions: 0,
    };
  }
}
