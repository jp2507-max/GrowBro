/**
 * Data Retention Service
 * Implements automated data retention and deletion workflows
 * Complies with GDPR Art. 5(1)(e) - Storage limitation
 */

import { supabase } from '@/lib/supabase';
import type {
  DataCategory,
  DataDeletionRecord,
  LegalHold,
  RetentionPolicyConfig,
} from '@/types/privacy';
import { DEFAULT_RETENTION_POLICY } from '@/types/privacy';

export class DataRetentionService {
  private retentionPolicy: RetentionPolicyConfig;

  constructor(
    retentionPolicy: RetentionPolicyConfig = DEFAULT_RETENTION_POLICY
  ) {
    this.retentionPolicy = retentionPolicy;
  }

  /**
   * Calculate retention expiry date for a data category
   */
  calculateExpiryDate(dataCategory: DataCategory, createdAt: Date): Date {
    const retentionDays =
      this.retentionPolicy.defaultRetentionDays[dataCategory];
    const expiryDate = new Date(createdAt);
    expiryDate.setDate(expiryDate.getDate() + retentionDays);
    return expiryDate;
  }

  /**
   * Check if data has expired based on retention policy
   */
  isExpired(
    dataCategory: DataCategory,
    createdAt: Date,
    gracePeriod: boolean = true
  ): boolean {
    const expiryDate = this.calculateExpiryDate(dataCategory, createdAt);
    const now = new Date();

    if (gracePeriod) {
      // Add grace period before physical deletion
      expiryDate.setDate(
        expiryDate.getDate() + this.retentionPolicy.gracePeriodDays
      );
    }

    return now >= expiryDate;
  }

  /**
   * Check if a record is under legal hold
   */
  async isUnderLegalHold(
    targetType: string,
    targetId: string
  ): Promise<boolean> {
    const { data, error } = await supabase
      .from('legal_holds')
      .select('id')
      .eq('target_type', targetType)
      .eq('target_id', targetId)
      .is('released_at', null)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned
      console.error('Error checking legal hold:', error);
      return false;
    }

    return !!data;
  }

  /**
   * Create a legal hold on data
   */
  async createLegalHold(
    legalHold: Omit<LegalHold, 'id' | 'createdAt'>
  ): Promise<LegalHold> {
    const { data, error } = await supabase
      .from('legal_holds')
      .insert({
        target_type: legalHold.targetType,
        target_id: legalHold.targetId,
        reason: legalHold.reason,
        legal_basis: legalHold.legalBasis,
        created_by: legalHold.createdBy,
        review_date: legalHold.reviewDate.toISOString(),
        metadata: legalHold.metadata,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create legal hold: ${error.message}`);
    }

    return {
      id: data.id,
      targetType: data.target_type,
      targetId: data.target_id,
      reason: data.reason,
      legalBasis: data.legal_basis,
      createdBy: data.created_by,
      createdAt: new Date(data.created_at),
      reviewDate: new Date(data.review_date),
      releasedAt: data.released_at ? new Date(data.released_at) : undefined,
      metadata: data.metadata,
    };
  }

  /**
   * Release a legal hold
   */
  async releaseLegalHold(legalHoldId: string): Promise<void> {
    const { error } = await supabase
      .from('legal_holds')
      .update({ released_at: new Date().toISOString() })
      .eq('id', legalHoldId);

    if (error) {
      throw new Error(`Failed to release legal hold: ${error.message}`);
    }
  }

  /**
   * Find expired records for a data category
   */
  async findExpiredRecords(
    tableName: string,
    dataCategory: DataCategory,
    limit: number = 100
  ): Promise<{ id: string; created_at: Date }[]> {
    const expiryDate = new Date();
    const retentionDays =
      this.retentionPolicy.defaultRetentionDays[dataCategory];
    const gracePeriodDays = this.retentionPolicy.gracePeriodDays;
    expiryDate.setDate(expiryDate.getDate() - retentionDays - gracePeriodDays);

    const { data, error } = await supabase
      .from(tableName)
      .select('id, created_at')
      .lt('created_at', expiryDate.toISOString())
      .is('deleted_at', null) // Not already deleted
      .limit(limit);

    if (error) {
      console.error(`Error finding expired records in ${tableName}:`, error);
      return [];
    }

    return (data || []).map((record) => ({
      id: record.id,
      created_at: new Date(record.created_at),
    }));
  }

  /**
   * Perform logical deletion (tombstone)
   */
  async logicalDelete(params: {
    tableName: string;
    recordId: string;
    deletedBy: string;
    reason: string;
  }): Promise<DataDeletionRecord> {
    const { tableName, recordId, deletedBy, reason } = params;
    const tombstoneUntil = new Date();
    tombstoneUntil.setDate(
      tombstoneUntil.getDate() + this.retentionPolicy.gracePeriodDays
    );

    // Mark record as deleted
    const { error: updateError } = await supabase
      .from(tableName)
      .update({
        deleted_at: new Date().toISOString(),
        tombstone_until: tombstoneUntil.toISOString(),
      })
      .eq('id', recordId);

    if (updateError) {
      throw new Error(
        `Failed to perform logical deletion: ${updateError.message}`
      );
    }

    // Create deletion record
    const deletionRecord: DataDeletionRecord = {
      id: crypto.randomUUID(),
      targetType: this.getTargetTypeFromTable(tableName),
      targetId: recordId,
      deletionType: 'logical',
      deletedAt: new Date(),
      deletedBy,
      reason,
      retentionPolicy: `${tableName}_retention`,
      tombstoneUntil,
      metadata: { tableName },
    };

    const { error: insertError } = await supabase
      .from('data_deletion_records')
      .insert({
        id: deletionRecord.id,
        target_type: deletionRecord.targetType,
        target_id: deletionRecord.targetId,
        deletion_type: deletionRecord.deletionType,
        deleted_at: deletionRecord.deletedAt.toISOString(),
        deleted_by: deletionRecord.deletedBy,
        reason: deletionRecord.reason,
        retention_policy: deletionRecord.retentionPolicy,
        tombstone_until: deletionRecord.tombstoneUntil?.toISOString(),
        metadata: deletionRecord.metadata,
      });

    if (insertError) {
      console.error('Failed to create deletion record:', insertError);
    }

    return deletionRecord;
  }

  /**
   * Perform physical deletion (permanent)
   */
  async physicalDelete(params: {
    tableName: string;
    recordId: string;
    deletedBy: string;
    reason: string;
  }): Promise<DataDeletionRecord> {
    const { tableName, recordId, deletedBy, reason } = params;
    // Delete the record permanently
    const { error: deleteError } = await supabase
      .from(tableName)
      .delete()
      .eq('id', recordId);

    if (deleteError) {
      throw new Error(
        `Failed to perform physical deletion: ${deleteError.message}`
      );
    }

    // Create deletion record
    const deletionRecord: DataDeletionRecord = {
      id: crypto.randomUUID(),
      targetType: this.getTargetTypeFromTable(tableName),
      targetId: recordId,
      deletionType: 'physical',
      deletedAt: new Date(),
      deletedBy,
      reason,
      retentionPolicy: `${tableName}_retention`,
      metadata: { tableName },
    };

    const { error: insertError } = await supabase
      .from('data_deletion_records')
      .insert({
        id: deletionRecord.id,
        target_type: deletionRecord.targetType,
        target_id: deletionRecord.targetId,
        deletion_type: deletionRecord.deletionType,
        deleted_at: deletionRecord.deletedAt.toISOString(),
        deleted_by: deletionRecord.deletedBy,
        reason: deletionRecord.reason,
        retention_policy: deletionRecord.retentionPolicy,
        metadata: deletionRecord.metadata,
      });

    if (insertError) {
      console.error('Failed to create deletion record:', insertError);
    }

    return deletionRecord;
  }

  /**
   * Process expired records for deletion
   */
  async processExpiredRecords(
    tableName: string,
    dataCategory: DataCategory,
    batchSize: number = 50
  ): Promise<{
    processed: number;
    deleted: number;
    skipped: number;
    errors: string[];
  }> {
    const expiredRecords = await this.findExpiredRecords(
      tableName,
      dataCategory,
      batchSize
    );

    let deleted = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const record of expiredRecords) {
      try {
        // Check for legal hold
        const underHold = await this.isUnderLegalHold(
          this.getTargetTypeFromTable(tableName),
          record.id
        );

        if (underHold) {
          skipped++;
          continue;
        }

        // Perform logical deletion first
        await this.logicalDelete(
          tableName,
          record.id,
          'system',
          'Retention policy expiry'
        );

        deleted++;
      } catch (error) {
        errors.push(
          `Failed to delete record ${record.id}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return {
      processed: expiredRecords.length,
      deleted,
      skipped,
      errors,
    };
  }

  /**
   * Process tombstoned records for physical deletion
   */
  async processTombstonedRecords(
    tableName: string,
    batchSize: number = 50
  ): Promise<{
    processed: number;
    deleted: number;
    errors: string[];
  }> {
    const now = new Date();

    // Find records past tombstone period
    const { data: tombstoned, error } = await supabase
      .from(tableName)
      .select('id')
      .not('deleted_at', 'is', null)
      .lt('tombstone_until', now.toISOString())
      .limit(batchSize);

    if (error) {
      console.error(`Error finding tombstoned records in ${tableName}:`, error);
      return { processed: 0, deleted: 0, errors: [error.message] };
    }

    let deleted = 0;
    const errors: string[] = [];

    for (const record of tombstoned || []) {
      try {
        await this.physicalDelete(
          tableName,
          record.id,
          'system',
          'Tombstone period expired'
        );
        deleted++;
      } catch (error) {
        errors.push(
          `Failed to physically delete record ${record.id}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return {
      processed: (tombstoned || []).length,
      deleted,
      errors,
    };
  }

  /**
   * Get target type from table name
   */
  private getTargetTypeFromTable(tableName: string): string {
    const mapping: Record<string, string> = {
      users: 'user',
      posts: 'content',
      comments: 'content',
      content_reports: 'report',
      moderation_decisions: 'decision',
      appeals: 'appeal',
      audit_events: 'audit',
    };

    return mapping[tableName] || tableName;
  }

  /**
   * Get retention policy configuration
   */
  getRetentionPolicy(): RetentionPolicyConfig {
    return { ...this.retentionPolicy };
  }

  /**
   * Update retention policy
   */
  updateRetentionPolicy(policy: Partial<RetentionPolicyConfig>): void {
    this.retentionPolicy = {
      ...this.retentionPolicy,
      ...policy,
    };
  }
}

// Export singleton instance
export const dataRetentionService = new DataRetentionService();
