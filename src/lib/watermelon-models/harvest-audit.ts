import { Model } from '@nozbe/watermelondb';
import { date, json, text } from '@nozbe/watermelondb/decorators';

import type {
  HarvestAuditAction,
  HarvestAuditStatus,
  HarvestStage,
} from '@/types';

/**
 * WatermelonDB model for harvest audit trail
 *
 * Tracks all state changes, overrides, undos, and reverts
 * Requirements: 9.2, 9.7
 */
export class HarvestAuditModel extends Model {
  static table = 'harvest_audits';

  @text('harvest_id') harvestId!: string;
  @text('user_id') userId?: string;

  @text('action') action!: HarvestAuditAction;
  @text('status') status!: HarvestAuditStatus;

  @text('from_stage') fromStage?: HarvestStage;
  @text('to_stage') toStage?: HarvestStage;

  @text('reason') reason!: string;

  /** Server-authoritative UTC timestamp */
  @date('performed_at') performedAt!: Date;

  /** Additional metadata (JSON) */
  @json('metadata', (raw) => raw as Record<string, unknown>)
  metadata!: Record<string, unknown>;

  @date('created_at') createdAt!: Date;
}
