/**
 * SoR Export Queue Manager - DSA Art. 24(5) Commission DB submission
 *
 * Manages queue for Commission Transparency Database submissions with:
 * - Idempotent enqueue by statement_id (unique constraint)
 * - Status tracking (pending → retry → submitted | failed → dlq)
 * - Retry counters and exponential backoff preparation
 * - Commission DB response storage
 *
 * Requirements: 3.3 (DSA Art. 24(5))
 */

import type {
  RedactedSoR,
  SoRExportQueue,
  SoRExportStatus,
} from '@/types/moderation';

import { supabase } from '../supabase';
import { piiScrubber } from './pii-scrubber';

// ============================================================================
// Types
// ============================================================================

export interface EnqueueResult {
  success: boolean;
  queue_id?: string;
  error?: string;
  already_enqueued?: boolean;
}

export interface UpdateStatusResult {
  success: boolean;
  error?: string;
}

export interface FetchPendingResult {
  success: boolean;
  items?: SoRExportQueue[];
  error?: string;
}

// ============================================================================
// Constants
// ============================================================================

const MAX_RETRY_ATTEMPTS = 5;
const DLQ_THRESHOLD = MAX_RETRY_ATTEMPTS;

// ============================================================================
// SoR Export Queue Manager
// ============================================================================

export class SoRExportQueueManager {
  /**
   * Enqueues a Statement of Reasons for Commission DB submission
   *
   * Idempotent: duplicate statement_id is ignored (returns existing queue entry)
   *
   * Requirements: 3.3 (DSA Art. 24(5))
   */
  async enqueue(
    statementId: string,
    redactedSoR: RedactedSoR
  ): Promise<EnqueueResult> {
    try {
      // Validate redaction before enqueue
      const validation = piiScrubber.validateRedaction(redactedSoR);
      if (!validation.is_valid) {
        return {
          success: false,
          error: `PII validation failed: ${validation.violations.join(', ')}`,
        };
      }

      // Generate idempotency key from statement_id
      const idempotencyKey = this.generateIdempotencyKey(statementId);

      // Check if already enqueued
      const { data: existing } = await supabase
        .from('sor_export_queue')
        .select('id, status')
        .eq('statement_id', statementId)
        .single();

      if (existing) {
        return {
          success: true,
          queue_id: existing.id,
          already_enqueued: true,
        };
      }

      // Insert into queue
      const queueEntry: Omit<
        SoRExportQueue,
        'id' | 'created_at' | 'updated_at'
      > = {
        statement_id: statementId,
        idempotency_key: idempotencyKey,
        status: 'pending',
        attempts: 0,
        last_attempt: undefined,
        transparency_db_response: undefined,
        error_message: undefined,
      };

      const { data, error } = await supabase
        .from('sor_export_queue')
        .insert(queueEntry)
        .select()
        .single();

      if (error) {
        // Check if duplicate (race condition)
        if (error.code === '23505') {
          // unique_violation
          const { data: raceCheck } = await supabase
            .from('sor_export_queue')
            .select('id')
            .eq('statement_id', statementId)
            .single();

          if (raceCheck) {
            return {
              success: true,
              queue_id: raceCheck.id,
              already_enqueued: true,
            };
          }
        }

        return {
          success: false,
          error: `Failed to enqueue SoR: ${error.message}`,
        };
      }

      return {
        success: true,
        queue_id: data.id,
        already_enqueued: false,
      };
    } catch (error) {
      return {
        success: false,
        error: `Enqueue failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Fetches pending items for processing
   *
   * Returns items with status 'pending' or 'retry'
   *
   * Requirements: 3.3
   */
  async fetchPending(limit: number = 100): Promise<FetchPendingResult> {
    try {
      const { data, error } = await supabase
        .from('sor_export_queue')
        .select('*')
        .in('status', ['pending', 'retry'])
        .order('attempts', { ascending: true }) // Process fewer retries first
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) {
        return {
          success: false,
          error: `Failed to fetch pending items: ${error.message}`,
        };
      }

      return {
        success: true,
        items: data as SoRExportQueue[],
      };
    } catch (error) {
      return {
        success: false,
        error: `Fetch pending failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Updates queue item status after submission attempt
   *
   * Requirements: 3.3
   */
  async updateStatus(params: {
    queueId: string;
    status: SoRExportStatus;
    transparencyDbResponse?: string;
    errorMessage?: string;
  }): Promise<UpdateStatusResult> {
    const { queueId, status, transparencyDbResponse, errorMessage } = params;
    try {
      const now = new Date().toISOString();

      // Get current attempts count
      const { data: current } = await supabase
        .from('sor_export_queue')
        .select('attempts')
        .eq('id', queueId)
        .single();

      const attempts = (current?.attempts || 0) + 1;

      // Determine final status
      let finalStatus = status;
      if (status === 'failed' && attempts >= DLQ_THRESHOLD) {
        finalStatus = 'dlq'; // Move to dead letter queue
      } else if (status === 'failed') {
        finalStatus = 'retry'; // Retry eligible
      }

      // Update queue entry
      const { error } = await supabase
        .from('sor_export_queue')
        .update({
          status: finalStatus,
          attempts,
          last_attempt: now,
          transparency_db_response: transparencyDbResponse,
          error_message: errorMessage,
          updated_at: now,
        })
        .eq('id', queueId);

      if (error) {
        return {
          success: false,
          error: `Failed to update queue status: ${error.message}`,
        };
      }

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: `Status update failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Marks submission as successful and stores Commission DB ID
   *
   * Requirements: 3.3
   */
  async markSubmitted(
    queueId: string,
    transparencyDbId: string
  ): Promise<UpdateStatusResult> {
    try {
      const now = new Date().toISOString();

      const { error } = await supabase
        .from('sor_export_queue')
        .update({
          status: 'submitted',
          transparency_db_response: JSON.stringify({
            transparency_db_id: transparencyDbId,
          }),
          updated_at: now,
        })
        .eq('id', queueId);

      if (error) {
        return {
          success: false,
          error: `Failed to mark as submitted: ${error.message}`,
        };
      }

      // Update the original statement with Commission DB ID
      const { data: queueItem } = await supabase
        .from('sor_export_queue')
        .select('statement_id')
        .eq('id', queueId)
        .single();

      if (queueItem) {
        await supabase
          .from('statements_of_reasons')
          .update({
            transparency_db_id: transparencyDbId,
            transparency_db_submitted_at: now,
          })
          .eq('id', queueItem.statement_id);
      }

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: `Mark submitted failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Gets retry-eligible items based on exponential backoff
   *
   * Backoff schedule:
   * - Attempt 1: immediate
   * - Attempt 2: 1 minute
   * - Attempt 3: 5 minutes
   * - Attempt 4: 15 minutes
   * - Attempt 5: 60 minutes
   *
   * Requirements: 3.3
   */
  async getRetryEligible(limit: number = 50): Promise<FetchPendingResult> {
    try {
      const now = new Date();

      // Calculate backoff thresholds
      const thresholds = [
        new Date(0), // Attempt 0 (pending): immediate
        new Date(now.getTime() - 1 * 60 * 1000), // Attempt 1: 1 min
        new Date(now.getTime() - 5 * 60 * 1000), // Attempt 2: 5 min
        new Date(now.getTime() - 15 * 60 * 1000), // Attempt 3: 15 min
        new Date(now.getTime() - 60 * 60 * 1000), // Attempt 4: 60 min
      ];

      const { data, error } = await supabase
        .from('sor_export_queue')
        .select('*')
        .eq('status', 'retry')
        .lt('attempts', MAX_RETRY_ATTEMPTS)
        .limit(limit);

      if (error) {
        return {
          success: false,
          error: `Failed to fetch retry-eligible items: ${error.message}`,
        };
      }

      // Filter by backoff eligibility
      const eligible = (data as SoRExportQueue[]).filter((item) => {
        if (!item.last_attempt) return true;

        const lastAttempt = new Date(item.last_attempt);
        const threshold =
          thresholds[Math.min(item.attempts, thresholds.length - 1)];

        return lastAttempt <= threshold;
      });

      return {
        success: true,
        items: eligible,
      };
    } catch (error) {
      return {
        success: false,
        error: `Get retry-eligible failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Gets dead letter queue items for manual review
   *
   * Requirements: 3.3
   */
  async getDLQItems(limit: number = 100): Promise<FetchPendingResult> {
    try {
      const { data, error } = await supabase
        .from('sor_export_queue')
        .select('*')
        .eq('status', 'dlq')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        return {
          success: false,
          error: `Failed to fetch DLQ items: ${error.message}`,
        };
      }

      return {
        success: true,
        items: data as SoRExportQueue[],
      };
    } catch (error) {
      return {
        success: false,
        error: `Get DLQ items failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Generates idempotency key from statement_id
   */
  private generateIdempotencyKey(statementId: string): string {
    return `sor-export-${statementId}`;
  }

  /**
   * Gets queue statistics
   */
  async getStats(): Promise<{
    pending: number;
    retry: number;
    submitted: number;
    failed: number;
    dlq: number;
  }> {
    const { data } = await supabase.from('sor_export_queue').select('status');

    if (!data) {
      return { pending: 0, retry: 0, submitted: 0, failed: 0, dlq: 0 };
    }

    const stats = {
      pending: 0,
      retry: 0,
      submitted: 0,
      failed: 0,
      dlq: 0,
    };

    data.forEach((item: any) => {
      stats[item.status as SoRExportStatus] =
        (stats[item.status as SoRExportStatus] || 0) + 1;
    });

    return stats;
  }
}

// Export singleton instance
export const sorExportQueueManager = new SoRExportQueueManager();
