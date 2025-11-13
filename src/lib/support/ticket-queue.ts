import { Q } from '@nozbe/watermelondb';
import { nanoid } from 'nanoid/non-secure';

import { storage, SUPPORT_STORAGE_KEYS } from '@/lib/storage';
import { database } from '@/lib/watermelon';
import type { SupportTicketQueueModel } from '@/lib/watermelon-models/support-ticket-queue';
import type { Attachment, DeviceContext, SupportTicket } from '@/types/support';

const MAX_QUEUE_SIZE = 50;
const MAX_QUEUE_SIZE_MB = 100;
const MAX_RETRY_COUNT = 5;
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;

interface QueueMetadata {
  totalTickets: number;
  totalSizeBytes: number;
  lastSync: number;
}

interface QueueTicketParams {
  category: SupportTicket['category'];
  subject: string;
  description: string;
  deviceContext: DeviceContext;
  attachments: Attachment[];
}

/**
 * Add ticket to queue
 */
export async function queueTicket(params: QueueTicketParams): Promise<string> {
  const { category, subject, description, deviceContext, attachments } = params;
  try {
    // Check queue limits
    const canQueue = await checkQueueLimits(attachments);
    if (!canQueue) {
      throw new Error('Queue limits exceeded');
    }

    const collection = database.get<SupportTicketQueueModel>(
      'support_tickets_queue'
    );
    const clientRequestId = nanoid();

    await database.write(async () => {
      await collection.create((record) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw = record._raw as any;
        raw.category = category;
        raw.subject = subject;
        raw.description = description;
        raw.device_context = JSON.stringify(deviceContext);
        raw.attachments = JSON.stringify(attachments);
        raw.status = 'open';
        raw.priority = 'medium';
        raw.retry_count = 0;
        raw.client_request_id = clientRequestId;
        // Ensure timestamps are set explicitly to numeric epoch ms so sorting queries work
        raw.created_at = Date.now();
        raw.updated_at = Date.now();
      });
    });

    await updateQueueMetadata();
    return clientRequestId;
  } catch (error) {
    console.error('Failed to queue ticket:', error);
    throw error;
  }
}

/**
 * Get all queued tickets
 */
export async function getQueuedTickets(): Promise<SupportTicket[]> {
  try {
    const collection = database.get<SupportTicketQueueModel>(
      'support_tickets_queue'
    );
    const records = await collection
      .query(Q.sortBy('created_at', Q.desc))
      .fetch();

    return records.map(recordToTicket);
  } catch (error) {
    console.error('Failed to get queued tickets:', error);
    return [];
  }
}

/**
 * Get pending tickets (ready to sync)
 */
export async function getPendingTickets(): Promise<SupportTicket[]> {
  try {
    const collection = database.get<SupportTicketQueueModel>(
      'support_tickets_queue'
    );
    const records = await collection
      .query(
        Q.where('status', 'open'),
        Q.where('retry_count', Q.lte(MAX_RETRY_COUNT)),
        Q.sortBy('created_at', Q.asc)
      )
      .fetch();

    return records.map(recordToTicket);
  } catch (error) {
    console.error('Failed to get pending tickets:', error);
    return [];
  }
}

/**
 * Mark ticket as sent
 */
export async function markTicketSent(
  clientRequestId: string,
  ticketReference: string
): Promise<void> {
  try {
    const collection = database.get<SupportTicketQueueModel>(
      'support_tickets_queue'
    );
    const records = await collection
      .query(Q.where('client_request_id', clientRequestId))
      .fetch();

    if (records.length === 0) {
      return;
    }

    await database.write(async () => {
      await records[0].update((record) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw = record._raw as any;
        raw.status = 'resolved';
        raw.ticket_reference = ticketReference;
        raw.resolved_at = Date.now();
        raw.updated_at = Date.now();
      });
    });

    await updateQueueMetadata();
  } catch (error) {
    console.error('Failed to mark ticket as sent:', error);
  }
}

/**
 * Mark ticket for retry with exponential backoff
 */
export async function markTicketForRetry(
  clientRequestId: string
): Promise<void> {
  try {
    const collection = database.get<SupportTicketQueueModel>(
      'support_tickets_queue'
    );
    const records = await collection
      .query(Q.where('client_request_id', clientRequestId))
      .fetch();

    if (records.length === 0) {
      return;
    }

    const record = records[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const currentRetryCount = ((record._raw as any).retry_count as number) || 0;

    if (currentRetryCount >= MAX_RETRY_COUNT) {
      // Max retries exceeded — this is a permanent failure. Mark the ticket
      // as 'failed' (distinct from 'resolved') so analytics, debug tools,
      // and any consumers can tell permanent failures apart from successful
      // resolutions. Do not treat this as a successful resolution.
      await database.write(async () => {
        await record.update((r) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const raw = r._raw as any;
          raw.status = 'failed'; // Remove from retryable queue
          raw.resolved_at = Date.now();
          raw.updated_at = Date.now();
        });
      });
      return;
    }

    await database.write(async () => {
      await record.update((r) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw = r._raw as any;
        raw.retry_count = currentRetryCount + 1;
        raw.last_retry_at = Date.now();
        raw.updated_at = Date.now();
      });
    });
  } catch (error) {
    console.error('Failed to mark ticket for retry:', error);
  }
}

/**
 * Calculate next retry delay using exponential backoff
 */
export function calculateBackoffDelay(retryCount: number): number {
  const delay = INITIAL_BACKOFF_MS * Math.pow(2, retryCount);
  return Math.min(delay, MAX_BACKOFF_MS);
}

/**
 * Check if ticket is ready for retry
 */
export function isReadyForRetry(ticket: SupportTicket): boolean {
  if (ticket.retryCount === 0) {
    return true;
  }

  const delay = calculateBackoffDelay(ticket.retryCount);
  const timeSinceLastRetry = Date.now() - (ticket.lastRetryAt || 0);

  return timeSinceLastRetry >= delay;
}

/**
 * Safe attachment parser used across the module
 */
const safeParseAttachmentsGlobal = (attachments: unknown): Attachment[] => {
  if (!attachments) return [];
  if (Array.isArray(attachments)) return attachments as Attachment[];
  if (typeof attachments === 'string') {
    try {
      const parsed = JSON.parse(attachments);
      return Array.isArray(parsed) ? (parsed as Attachment[]) : [];
    } catch (error) {
      console.warn('Failed to parse attachments JSON:', error);
      return [];
    }
  }
  return [];
};

/**
 * Check queue size limits
 * Note: This check is not atomic and concurrent calls may allow slight overage
 * of queue limits, which is acceptable for an offline queue to avoid complexity.
 */
async function checkQueueLimits(attachments: Attachment[]): Promise<boolean> {
  try {
    const collection = database.get<SupportTicketQueueModel>(
      'support_tickets_queue'
    );
    const records = await collection.query().fetch();

    // Check ticket count limit
    if (records.length >= MAX_QUEUE_SIZE) {
      return false;
    }

    // Calculate total queue size
    const attachmentSize = attachments.reduce(
      (sum, att) => sum + att.sizeBytes,
      0
    );
    const currentSize = records.reduce((sum, record) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const atts = safeParseAttachmentsGlobal((record._raw as any).attachments);
      return sum + atts.reduce((s, a) => s + a.sizeBytes, 0);
    }, 0);

    const totalSize = currentSize + attachmentSize;
    const maxSizeBytes = MAX_QUEUE_SIZE_MB * 1024 * 1024;

    return totalSize <= maxSizeBytes;
  } catch (error) {
    console.error('Failed to check queue limits:', error);
    return false;
  }
}

/**
 * Update queue metadata
 */
async function updateQueueMetadata(): Promise<void> {
  try {
    const collection = database.get<SupportTicketQueueModel>(
      'support_tickets_queue'
    );
    const records = await collection.query().fetch();

    const totalSizeBytes = records.reduce((sum, record) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const atts = safeParseAttachmentsGlobal((record._raw as any).attachments);
      return sum + atts.reduce((s, a) => s + a.sizeBytes, 0);
    }, 0);

    const metadata: QueueMetadata = {
      totalTickets: records.length,
      totalSizeBytes,
      lastSync: Date.now(),
    };

    storage.set(
      SUPPORT_STORAGE_KEYS.SUPPORT_QUEUE_META,
      JSON.stringify(metadata)
    );
  } catch (error) {
    console.error('Failed to update queue metadata:', error);
  }
}

/**
 * Get queue metadata
 */
export function getQueueMetadata(): QueueMetadata | null {
  const cached = storage.getString(SUPPORT_STORAGE_KEYS.SUPPORT_QUEUE_META);
  if (!cached) {
    return null;
  }

  try {
    return JSON.parse(cached) as QueueMetadata;
  } catch {
    return null;
  }
}

/**
 * Clear resolved tickets older than retention period
 */
export async function cleanupOldTickets(retentionDays = 90): Promise<void> {
  try {
    const collection = database.get<SupportTicketQueueModel>(
      'support_tickets_queue'
    );
    const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

    const oldRecords = await collection
      .query(
        Q.where('status', 'resolved'),
        Q.where('resolved_at', Q.notEq(null)),
        Q.where('resolved_at', Q.lt(cutoffTime))
      )
      .fetch();

    await database.write(async () => {
      for (const record of oldRecords) {
        await record.markAsDeleted();
      }
    });

    await updateQueueMetadata();
  } catch (error) {
    console.error('Failed to cleanup old tickets:', error);
  }
}

/**
 * Convert WatermelonDB record to SupportTicket
 */
function recordToTicket(record: SupportTicketQueueModel): SupportTicket {
  // NOTE: Queued tickets are stored with a generated client_request_id and all mutation helpers
  // (markTicketSent, markTicketForRetry) look up records by that value, but recordToTicket
  // exposes the Watermelon record ID instead (id: record.id). Hooks such as usePendingSupportTickets
  // then pass ticket.id into markTicketSent, so the query Q.where('client_request_id', clientRequestId)
  // never finds a match and the ticket remains stuck in the queue even after a successful upload.
  // Any sync loop will keep retrying indefinitely. The returned ticket identifier should be the
  // client_request_id, not the internal row ID.
  return {
    id: record.clientRequestId,
    category: record.category,
    subject: record.subject,
    description: record.description,
    deviceContext: record.deviceContext,
    attachments: record.attachments,
    status: record.status,
    priority: record.priority,
    ticketReference: record.ticketReference || undefined,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    resolvedAt: record.resolvedAt || undefined,
    retryCount: record.retryCount,
    lastRetryAt: record.lastRetryAt || undefined,
  };
}
