import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

import type {
  Attachment,
  DeviceContext,
  SupportCategory,
  SupportPriority,
  SupportStatus,
} from '@/types/support';

export class SupportTicketQueueModel extends Model {
  static table = 'support_tickets_queue';

  @text('category') category!: SupportCategory;
  @text('subject') subject!: string;
  @text('description') description!: string;
  @text('device_context') deviceContextJson!: string;
  @text('attachments') attachmentsJson!: string;
  @text('status') status!: SupportStatus;
  @text('priority') priority!: SupportPriority;
  @text('ticket_reference') ticketReference?: string | null;
  @field('retry_count') retryCount!: number;
  @field('last_retry_at') lastRetryAt?: number | null;
  @field('resolved_at') resolvedAt?: number | null;
  @text('client_request_id') clientRequestId!: string;
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;

  get deviceContext(): DeviceContext {
    try {
      return JSON.parse(this.deviceContextJson) as DeviceContext;
    } catch (error) {
      console.warn(
        '[SupportTicketQueueModel] Failed to parse device context',
        error
      );
      return {
        appVersion: 'unknown',
        osVersion: 'unknown',
        deviceModel: 'unknown',
        locale: 'en',
      };
    }
  }

  setDeviceContext(context: DeviceContext): void {
    this.deviceContextJson = JSON.stringify(context);
  }

  get attachments(): Attachment[] {
    try {
      return JSON.parse(this.attachmentsJson) as Attachment[];
    } catch (error) {
      console.warn(
        '[SupportTicketQueueModel] Failed to parse attachments',
        error
      );
      return [];
    }
  }

  setAttachments(attachments: Attachment[]): void {
    this.attachmentsJson = JSON.stringify(attachments);
  }
}
