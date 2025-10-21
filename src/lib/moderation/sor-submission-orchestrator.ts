/**
 * SoR Submission Orchestrator
 *
 * Orchestrates the complete flow for submitting Statements of Reasons to DSA Transparency Database:
 * 1. PII scrubbing with validation
 * 2. Queue management with idempotency
 * 3. Circuit breaker protection
 * 4. API submission with retry logic
 * 5. Metrics tracking
 * 6. Error handling and DLQ management
 *
 * Requirements: 3.4 (submit redacted SoR without undue delay), 6.4 (SoR export queue)
 */

import type { ContentReport, StatementOfReasons } from '@/types/moderation';

import { dsaTransparencyClient } from './dsa-transparency-client';
import { piiScrubber } from './pii-scrubber';
import { dsaCircuitBreaker } from './sor-circuit-breaker';
import { sorExportQueueManager } from './sor-export-queue';
import { sorMetrics } from './sor-metrics';

// ============================================================================
// Types
// ============================================================================

export interface SubmissionContext {
  reports?: ContentReport[];
  hasTrustedFlagger?: boolean;
  evidenceUrls?: string[];
  contentCreatedAt?: Date;
  moderator_id?: string;
}

export interface SubmissionResult {
  success: boolean;
  transparencyDbId?: string;
  queueId?: string;
  error?: string;
  wasQueued: boolean;
  gracefullyDegraded: boolean;
}

// ============================================================================
// Orchestrator
// ============================================================================

export class SoRSubmissionOrchestrator {
  /**
   * Submit Statement of Reasons to DSA Transparency Database.
   *
   * Complete flow with PII scrubbing, queue management, circuit breaker protection,
   * and metrics tracking.
   *
   * Requirements: 3.4, 6.4
   */
  async submit(
    sor: StatementOfReasons,
    context: SubmissionContext = {}
  ): Promise<SubmissionResult> {
    const startTime = Date.now();

    try {
      const redactedSoR = await this.scrubAndValidate(sor, context);
      const enqueueResult = await this.enqueueSubmission(sor.id, redactedSoR);

      return await this.attemptSubmission(
        redactedSoR,
        enqueueResult.queue_id!,
        startTime
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      sorMetrics.recordSubmission(duration, false);

      return {
        success: false,
        wasQueued: false,
        gracefullyDegraded: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async scrubAndValidate(
    sor: StatementOfReasons,
    context: SubmissionContext
  ) {
    const scrubContext = {
      report_count: context.reports?.length || 1,
      evidence_type: piiScrubber.categorizeEvidenceType(
        context.evidenceUrls || []
      ),
      content_age: piiScrubber.categorizeContentAge(
        context.contentCreatedAt || new Date()
      ),
      jurisdiction_count: sor.territorial_scope?.length || 0,
      has_trusted_flagger: context.hasTrustedFlagger || false,
      moderator_id: context.moderator_id,
    };

    const redactedSoR = await piiScrubber.scrubStatementOfReasons(
      sor,
      scrubContext
    );
    const validation = piiScrubber.validateRedaction(redactedSoR);

    if (!validation.is_valid) {
      throw new Error(
        `PII validation failed: ${validation.violations.join(', ')}`
      );
    }

    return redactedSoR;
  }

  private async enqueueSubmission(sorId: string, redactedSoR: any) {
    const enqueueResult = await sorExportQueueManager.enqueue(
      sorId,
      redactedSoR
    );

    if (!enqueueResult.success) {
      throw new Error(enqueueResult.error || 'Failed to enqueue SoR');
    }

    return enqueueResult;
  }

  private async attemptSubmission(
    redactedSoR: any,
    queueId: string,
    startTime: number
  ): Promise<SubmissionResult> {
    let capturedTransparencyDbId: string | undefined;

    try {
      await dsaCircuitBreaker.execute(async () => {
        const submissionResult = await dsaTransparencyClient.submitSingle(
          redactedSoR,
          queueId
        );

        if (submissionResult.status === 'submitted') {
          await sorExportQueueManager.markSubmitted(
            queueId,
            submissionResult.transparency_db_id!
          );
          capturedTransparencyDbId = submissionResult.transparency_db_id;
          const duration = Date.now() - startTime;
          sorMetrics.recordSubmission(duration, true);
          return submissionResult;
        } else {
          throw new Error(
            submissionResult.error?.message || 'Submission failed'
          );
        }
      });

      return {
        success: true,
        queueId,
        wasQueued: true,
        gracefullyDegraded: false,
        transparencyDbId: capturedTransparencyDbId,
      };
    } catch (circuitError) {
      await sorExportQueueManager.updateStatus({
        queueId,
        status: 'failed',
        errorMessage:
          circuitError instanceof Error
            ? circuitError.message
            : 'Unknown error',
      });

      sorMetrics.recordRetry();
      const duration = Date.now() - startTime;
      sorMetrics.recordSubmission(duration, false);

      return {
        success: false,
        queueId,
        wasQueued: true,
        gracefullyDegraded: true,
        error:
          circuitError instanceof Error
            ? circuitError.message
            : 'Circuit breaker protection activated',
      };
    }
  }

  /**
   * Process pending items from queue.
   *
   * Background job to process queued submissions.
   */
  async processPendingQueue(batchSize: number = 50): Promise<void> {
    try {
      // Fetch retry-eligible items
      const result = await sorExportQueueManager.getRetryEligible(batchSize);

      if (!result.success || !result.items || result.items.length === 0) {
        return;
      }

      // Process each item
      for (const queueItem of result.items) {
        try {
          // Fetch original statement
          const { data: statement } = await this.fetchStatement(
            queueItem.statement_id
          );

          if (!statement) {
            console.error(`Statement not found for queue item ${queueItem.id}`);
            continue;
          }

          // Re-scrub and submit
          await this.submit(statement as StatementOfReasons);
        } catch (error) {
          console.error(`Failed to process queue item ${queueItem.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Failed to process pending queue:', error);
    }
  }

  /**
   * Get current metrics.
   */
  getMetrics() {
    return sorMetrics.getMetrics();
  }

  /**
   * Get circuit breaker stats.
   */
  getCircuitStats() {
    return dsaCircuitBreaker.getStats();
  }

  /**
   * Get queue stats.
   */
  async getQueueStats() {
    return await sorExportQueueManager.getStats();
  }

  /**
   * Check system health.
   */
  async checkHealth(): Promise<{
    healthy: boolean;
    circuitOpen: boolean;
    dlqExceeded: boolean;
    latencySLABreached: boolean;
  }> {
    const circuitStats = dsaCircuitBreaker.getStats();
    const metrics = sorMetrics.getMetrics();

    const dlqThreshold = 100; // Configure as needed
    const latencySLAMs = 5000; // 5 seconds

    return {
      healthy:
        circuitStats.state === 'CLOSED' && metrics.dlqCount < dlqThreshold,
      circuitOpen: circuitStats.state === 'OPEN',
      dlqExceeded: metrics.dlqCount >= dlqThreshold,
      latencySLABreached: metrics.p95LatencyMs > latencySLAMs,
    };
  }

  /**
   * Fetch statement from database (mock - implement with actual DB call).
   */
  private async fetchStatement(
    _statementId: string
  ): Promise<{ data: StatementOfReasons | null }> {
    // TODO: Implement actual database fetch
    // This is a placeholder
    return { data: null };
  }
}

// Export singleton instance
export const sorSubmissionOrchestrator = new SoRSubmissionOrchestrator();

// Export class for testing
export { SoRSubmissionOrchestrator as SoRSubmissionOrchestratorClass };
