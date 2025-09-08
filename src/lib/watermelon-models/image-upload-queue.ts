import { Model } from '@nozbe/watermelondb';
import { date, field, text } from '@nozbe/watermelondb/decorators';

export class ImageUploadQueueModel extends Model {
  static table = 'image_upload_queue';

  @text('local_uri') localUri!: string;
  @text('remote_path') remotePath?: string;
  @text('task_id') taskId?: string;
  @text('plant_id') plantId?: string;
  @text('filename') filename?: string;
  @text('mime_type') mimeType?: string;
  @text('status') status!: 'pending' | 'uploading' | 'completed' | 'failed';
  @field('retry_count') retryCount?: number;
  @text('last_error') lastError?: string;
  @field('next_attempt_at') nextAttemptAt?: number;
  // Watermelon stores numbers (ms) in @date decorator
  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
}
