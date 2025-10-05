import { Model } from '@nozbe/watermelondb';
import { date, field, json, text } from '@nozbe/watermelondb/decorators';

import type {
  GrowPhase,
  Playbook as PlaybookType,
  PlaybookMetadata,
  PlaybookSetup,
  PlaybookStep,
} from '@/types/playbook';

/**
 * Playbook Model
 * Represents a grow playbook template with steps and metadata
 */
export class PlaybookModel extends Model {
  static table = 'playbooks';

  @text('name') name!: string;
  @text('setup') setup!: PlaybookSetup;
  @text('locale') locale!: string;

  @json('phase_order', (raw) => (raw ? (raw as GrowPhase[]) : undefined))
  phaseOrder?: GrowPhase[];

  @json('steps', (raw) => raw as PlaybookStep[])
  steps!: PlaybookStep[];

  @json('metadata', (raw) => (raw ? (raw as PlaybookMetadata) : undefined))
  metadata?: PlaybookMetadata;

  @field('is_template') isTemplate!: boolean;
  @field('is_community') isCommunity!: boolean;
  @text('author_handle') authorHandle?: string;
  @text('license') license?: string;

  @field('server_revision') serverRevision?: number;
  @field('server_updated_at_ms') serverUpdatedAtMs?: number;

  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
  @date('deleted_at') deletedAt?: Date;

  /**
   * Convert model to plain object
   */
  toPlaybook(): PlaybookType {
    return {
      id: this.id,
      name: this.name,
      setup: this.setup,
      locale: this.locale,
      phaseOrder: this.phaseOrder || [],
      steps: this.steps,
      metadata: this.metadata || {},
      isTemplate: this.isTemplate,
      isCommunity: this.isCommunity,
      authorHandle: this.authorHandle,
      license: this.license,
      serverRevision: this.serverRevision,
      serverUpdatedAtMs: this.serverUpdatedAtMs,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      deletedAt: this.deletedAt?.toISOString(),
    };
  }
}
