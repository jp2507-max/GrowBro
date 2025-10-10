import { Model, type Relation } from '@nozbe/watermelondb';
import {
  date,
  field,
  json,
  relation,
  text,
} from '@nozbe/watermelondb/decorators';

import type { PhEcReadingModel } from './ph-ec-reading';

/**
 * WatermelonDB model for deviation alerts
 *
 * Tracks pH/EC alerts triggered by out-of-range measurements.
 * Stores recommendations and tracks alert lifecycle.
 *
 * Requirements: 2.5, 6.2
 */
export class DeviationAlertModel extends Model {
  static table = 'deviation_alerts';

  @text('reading_id') readingId!: string;

  /** Alert type: ph_high | ph_low | ec_high | ec_low | calibration_stale | temp_high */
  @text('type') type!: string;

  /** Alert severity: low | medium | high | critical */
  @text('severity') severity!: string;

  @text('message') message!: string;

  /** JSON array of recommendation strings */
  @json('recommendations_json', (raw) => (raw as string[]) || [])
  recommendations!: string[];

  /** JSON array of recommendation codes for programmatic handling */
  @json('recommendation_codes_json', (raw) => (raw as string[]) || [])
  recommendationCodes!: string[];

  /** Cooldown expiry timestamp (epoch ms) to prevent alert spam */
  @field('cooldown_until') cooldownUntil?: number;

  /** Alert triggered timestamp (epoch ms) */
  @field('triggered_at') triggeredAt!: number;

  /** Alert acknowledged timestamp (epoch ms) */
  @field('acknowledged_at') acknowledgedAt?: number;

  /** Alert resolved timestamp (epoch ms) */
  @field('resolved_at') resolvedAt?: number;

  /** Local delivery timestamp for offline sync (epoch ms) */
  @field('delivered_at_local') deliveredAtLocal?: number;

  @text('user_id') userId?: string;

  /** Sync: server revision number for conflict resolution */
  @field('server_revision') serverRevision?: number;

  /** Sync: server timestamp in milliseconds for LWW */
  @field('server_updated_at_ms') serverUpdatedAtMs?: number;

  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
  @date('deleted_at') deletedAt?: Date;

  // Relations
  @relation('ph_ec_readings', 'reading_id')
  reading!: Relation<PhEcReadingModel>;

  /**
   * Check if alert was delivered locally while offline
   * Used for sync to mirror offline alerts to server
   */
  get wasDeliveredOffline(): boolean {
    return this.deliveredAtLocal !== undefined && this.deliveredAtLocal > 0;
  }

  /**
   * Mark alert as delivered locally (for offline mode)
   * Call this when displaying alert notification while offline
   */
  async markDeliveredLocally(): Promise<void> {
    await this.update(() => {
      this.deliveredAtLocal = Date.now();
    });
  }

  /**
   * Acknowledge alert
   */
  async acknowledge(): Promise<void> {
    await this.update(() => {
      this.acknowledgedAt = Date.now();
    });
  }

  /**
   * Resolve alert
   */
  async resolve(): Promise<void> {
    await this.update(() => {
      this.resolvedAt = Date.now();
    });
  }

  /**
   * Check if alert is currently active
   */
  get isActive(): boolean {
    return !this.acknowledgedAt && !this.resolvedAt;
  }

  /**
   * Check if alert is in cooldown period
   */
  get isInCooldown(): boolean {
    if (!this.cooldownUntil) return false;
    return Date.now() < this.cooldownUntil;
  }
}
