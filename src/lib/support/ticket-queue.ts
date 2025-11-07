import { Q } from '@nozbe/watermelondb';
import { nanoid } from 'nanoid/non-secure';

import { storage, SUPPORT_STORAGE_KEYS } from '@/lib/storage';
import { database } from '@/lib/watermelon';
import { SupportTicketQueueModel } from '@/lib/watermelon-models/support-ticket-queue';
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

    const collection = database.get('support_tickets_queue');
    const clientRequestId = nanoid();

    await database.write(async () => {
      await collection.create((record) => {
        record._raw.category = category;
        record._raw.subject = subject;
        record._raw.description = description;
        record._raw.device_context = JSON.stringify(deviceContext);
        record._raw.attachments = JSON.stringify(attachments);
        record._raw.status = 'open';
        record._raw.priority = 'medium';
        record._raw.retry_count = 0;
        record._raw.client_request_id = clientRequestId;
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
    const collection = database.get('support_tickets_queue');
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
    const collection = database.get('support_tickets_queue');
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
    const collection = database.get('support_tickets_queue');
    const records = await collection
      .query(Q.where('client_request_id', clientRequestId))
      .fetch();

    if (records.length === 0) {
      return;
    }

    await database.write(async () => {
      await records[0].update((record) => {
        record._raw.status = 'resolved';
        record._raw.ticket_reference = ticketReference;
        record._raw.resolved_at = Date.now();
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
    const collection = database.get('support_tickets_queue');
    const records = await collection
      .query(Q.where('client_request_id', clientRequestId))
      .fetch();

    if (records.length === 0) {
      return;
    }

    const record = records[0];
    const currentRetryCount = (record._raw.retry_count as number) || 0;

    if (currentRetryCount >= MAX_RETRY_COUNT) {
      // Max retries exceeded, mark as failed
      await database.write(async () => {
        await record.update((r) => {
          r._raw.status = 'resolved'; // Remove from queue
          r._raw.resolved_at = Date.now();
        });
      });
      return;
    }

    await database.write(async () => {
      await record.update((r) => {
        r._raw.retry_count = currentRetryCount + 1;
        r._raw.last_retry_at = Date.now();
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
 * Check queue size limits
 */
async function checkQueueLimits(attachments: Attachment[]): Promise<boolean> {
  try {
    const collection = database.get('support_tickets_queue');
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
      const atts = JSON.parse(
        record._raw.attachments as string
      ) as Attachment[];
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
    const collection = database.get('support_tickets_queue');
    const records = await collection.query().fetch();

    const totalSizeBytes = records.reduce((sum, record) => {
      const atts = JSON.parse(
        record._raw.attachments as string
      ) as Attachment[];
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
    const collection = database.get('support_tickets_queue');
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
function recordToTicket(record: SupportTicketQueueModel | any): SupportTicket {
  // Check if record is a SupportTicketQueueModel instance
  if (record instanceof SupportTicketQueueModel) {
    return {
      id: record.id,
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

  // Fallback for raw records (with safe JSON parsing)
  const parseJson = <T>(jsonString: string, defaultValue: T): T => {
    try {
      return JSON.parse(jsonString) as T;
    } catch (error) {
      console.warn('Failed to parse JSON in recordToTicket:', error);
      return defaultValue;
    }
  };

  return {
    id: record.id,
    category: record._raw.category,
    subject: record._raw.subject,
    description: record._raw.description,
    deviceContext: parseJson(record._raw.device_context, {
      appVersion: 'unknown',
      osVersion: 'unknown',
      deviceModel: 'unknown',
      locale: 'en',
    }),
    attachments: parseJson(record._raw.attachments, []),
    status: record._raw.status,
    priority: record._raw.priority,
    ticketReference: record._raw.ticket_reference,
    createdAt: record._raw.created_at,
    updatedAt: record._raw.updated_at,
    resolvedAt: record._raw.resolved_at,
    retryCount: record._raw.retry_count,
    lastRetryAt: record._raw.last_retry_at,
  };
}
