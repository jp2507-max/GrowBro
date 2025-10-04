import { Model } from '@nozbe/watermelondb';
import { date, field, text } from '@nozbe/watermelondb/decorators';

/**
 * Playbook Application Model
 * Tracks when playbooks are applied to plants with idempotency
 */
export class PlaybookApplicationModel extends Model {
  static table = 'playbook_applications';

  @text('playbook_id') playbookId!: string;
  @text('plant_id') plantId!: string;
  @date('applied_at') appliedAt!: Date;
  @field('task_count') taskCount!: number;
  @field('duration_ms') durationMs!: number;
  @text('job_id') jobId!: string;
  @text('idempotency_key') idempotencyKey?: string;
  @text('status') status!: 'pending' | 'completed' | 'failed';

  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
}
